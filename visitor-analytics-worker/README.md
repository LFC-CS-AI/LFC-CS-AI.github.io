# Persistent visitor analytics backend

This Cloudflare Worker stores permanent aggregate visit counts by country in D1.
It does not store IP addresses, city names, coordinates, or street addresses.

## Endpoints

- `POST /api/visit` - increments the country inferred by Cloudflare
- `GET /api/stats` - returns all-time aggregate country totals
- `GET /health` - health and storage check

The website should call `POST /api/visit` at most once per browser per day.

## Deployment

The D1 binding is automatically provisioned by Wrangler. For a temporary preview
that can later be claimed by the site owner:

```powershell
npx wrangler@latest deploy --temporary
```

The temporary deployment must be claimed within 60 minutes. After it is claimed,
authenticate Wrangler with the claimed Cloudflare account and deploy without the
`--temporary` flag.
