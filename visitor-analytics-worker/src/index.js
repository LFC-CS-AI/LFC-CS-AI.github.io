const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff"
};

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS country_totals (
    country_code TEXT PRIMARY KEY,
    visits INTEGER NOT NULL DEFAULT 0,
    last_seen TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS daily_totals (
    visit_date TEXT NOT NULL,
    country_code TEXT NOT NULL,
    visits INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (visit_date, country_code)
  )`
];

function isAllowedOrigin(origin, siteOrigin) {
  if (origin === siteOrigin) {
    return true;
  }

  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || "");
}

function corsHeaders(request, env) {
  const origin = request.headers.get("origin") || "";
  const allowed = isAllowedOrigin(origin, env.SITE_ORIGIN);

  return {
    "access-control-allow-origin": allowed ? origin : env.SITE_ORIGIN,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    "vary": "Origin"
  };
}

function json(data, init = {}, request, env) {
  const headers = new Headers(init.headers || {});

  for (const [key, value] of Object.entries(JSON_HEADERS)) {
    headers.set(key, value);
  }

  if (request && env) {
    for (const [key, value] of Object.entries(corsHeaders(request, env))) {
      headers.set(key, value);
    }
  }

  return new Response(JSON.stringify(data), { ...init, headers });
}

async function ensureSchema(db) {
  await db.batch(SCHEMA.map((sql) => db.prepare(sql)));
}

function normalizeCountry(value) {
  const country = String(value || "XX").toUpperCase();
  return /^[A-Z]{2}$/.test(country) ? country : "XX";
}

async function recordVisit(request, env) {
  const origin = request.headers.get("origin") || "";

  if (!isAllowedOrigin(origin, env.SITE_ORIGIN)) {
    return json({ error: "origin_not_allowed" }, { status: 403 }, request, env);
  }

  await ensureSchema(env.DB);

  const countryCode = normalizeCountry(request.cf && request.cf.country);
  const now = new Date().toISOString();
  const visitDate = now.slice(0, 10);

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO country_totals (country_code, visits, last_seen)
      VALUES (?1, 1, ?2)
      ON CONFLICT(country_code) DO UPDATE SET
        visits = visits + 1,
        last_seen = excluded.last_seen
    `).bind(countryCode, now),
    env.DB.prepare(`
      INSERT INTO daily_totals (visit_date, country_code, visits)
      VALUES (?1, ?2, 1)
      ON CONFLICT(visit_date, country_code) DO UPDATE SET
        visits = visits + 1
    `).bind(visitDate, countryCode)
  ]);

  const total = await env.DB.prepare(
    "SELECT COALESCE(SUM(visits), 0) AS visits FROM country_totals"
  ).first();

  return json({
    recorded: true,
    country_code: countryCode,
    total_visits: Number(total && total.visits || 0)
  }, { headers: { "cache-control": "no-store" } }, request, env);
}

async function getStats(request, env) {
  await ensureSchema(env.DB);

  const result = await env.DB.prepare(`
    SELECT country_code, visits, last_seen
    FROM country_totals
    ORDER BY visits DESC, country_code ASC
  `).all();

  const countries = (result.results || []).map((row) => ({
    country_code: row.country_code,
    visits: Number(row.visits),
    last_seen: row.last_seen
  }));

  return json({
    total_visits: countries.reduce((sum, row) => sum + row.visits, 0),
    countries,
    generated_at: new Date().toISOString()
  }, { headers: { "cache-control": "no-store" } }, request, env);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      const origin = request.headers.get("origin") || "";
      if (!isAllowedOrigin(origin, env.SITE_ORIGIN)) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    if (url.pathname === "/api/visit" && request.method === "POST") {
      return recordVisit(request, env);
    }

    if (url.pathname === "/api/stats" && request.method === "GET") {
      return getStats(request, env);
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return json({ status: "ok", storage: "d1", ip_stored: false });
    }

    return json({
      service: "Fengchi Liu visitor analytics",
      endpoints: ["GET /health", "GET /api/stats", "POST /api/visit"],
      privacy: "Only aggregate country-level counts are stored."
    });
  }
};
