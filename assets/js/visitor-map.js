(function () {
  "use strict";

  var API_BASE = "https://lfc-visitor-analytics.mature-steed.workers.dev";
  var MAP_DATA_URL = "assets/maps/world-countries-110m.geojson";
  var BACKUP_URL = "assets/data/visitor-stats-backup.json";
  var COUNTED_DATE_KEY = "lfc-visitor-counted-date-v1";
  var SVG_NS = "http://www.w3.org/2000/svg";

  var host = document.getElementById("visitor-map-embed");
  var svg = document.getElementById("visitor-map-svg");
  var status = document.getElementById("visitor-map-status");
  var dataNote = document.getElementById("visitor-map-data-note");
  var totalNode = document.getElementById("visitor-total");
  var locationTotalNode = document.getElementById("visitor-location-total");
  var footerTotalNode = document.getElementById("footer-visitor-total");
  var countryList = document.getElementById("visitor-country-list");

  if (!host || !svg || !status || !countryList) {
    return;
  }

  var displayNames = null;
  if (typeof Intl.DisplayNames === "function") {
    displayNames = new Intl.DisplayNames(["en"], { type: "region" });
  }

  function svgElement(name, attributes) {
    var node = document.createElementNS(SVG_NS, name);
    Object.keys(attributes || {}).forEach(function (key) {
      node.setAttribute(key, String(attributes[key]));
    });
    return node;
  }

  function appendTitle(node, text) {
    var title = svgElement("title");
    title.textContent = text;
    node.appendChild(title);
  }

  function countryName(code, fallback) {
    if (code === "XX") {
      return "Unknown region";
    }

    if (displayNames) {
      try {
        return displayNames.of(code) || fallback || code;
      } catch (error) {
        // Fall through to the Natural Earth name.
      }
    }

    return fallback || code;
  }

  function formattedNumber(value) {
    return Number(value || 0).toLocaleString("en-US");
  }

  function readCountedDate() {
    try {
      return window.localStorage.getItem(COUNTED_DATE_KEY);
    } catch (error) {
      return null;
    }
  }

  function writeCountedDate(value) {
    try {
      window.localStorage.setItem(COUNTED_DATE_KEY, value);
    } catch (error) {
      // Analytics still works when storage is blocked; the date simply is not retained.
    }
  }

  async function fetchJson(url, options) {
    var response = await window.fetch(url, options || {});
    if (!response.ok) {
      throw new Error("Request failed with status " + response.status);
    }

    return response.json();
  }

  async function recordVisit() {
    var today = new Date().toISOString().slice(0, 10);
    if (readCountedDate() === today) {
      return;
    }

    var result = await fetchJson(API_BASE + "/api/visit", {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      cache: "no-store"
    });

    if (result && result.recorded) {
      writeCountedDate(today);
    }
  }

  async function loadStatistics() {
    try {
      var live = await fetchJson(API_BASE + "/api/stats?ts=" + Date.now(), {
        mode: "cors",
        credentials: "omit",
        cache: "no-store"
      });
      live.source = "live";
      return live;
    } catch (liveError) {
      var backup = await fetchJson(BACKUP_URL + "?ts=" + Date.now(), { cache: "no-store" });
      backup.source = "backup";
      return backup;
    }
  }

  function normalizedRows(data) {
    return (data && Array.isArray(data.countries) ? data.countries : [])
      .map(function (row) {
        var code = String(row.country_code || "XX").toUpperCase();
        var visits = Number(row.visits || 0);
        return {
          code: /^[A-Z]{2}$/.test(code) ? code : "XX",
          visits: Number.isFinite(visits) && visits > 0 ? Math.floor(visits) : 0
        };
      })
      .filter(function (row) { return row.visits > 0; })
      .sort(function (a, b) { return b.visits - a.visits || a.code.localeCompare(b.code); });
  }

  function renderCountryList(rows, featureByCode) {
    countryList.replaceChildren();

    if (!rows.length) {
      var empty = document.createElement("li");
      empty.className = "visitor-country-empty";
      empty.textContent = "No visits have been recorded yet.";
      countryList.appendChild(empty);
      return;
    }

    rows.forEach(function (row) {
      var feature = featureByCode.get(row.code);
      var item = document.createElement("li");
      var marker = document.createElement("span");
      var name = document.createElement("span");
      var count = document.createElement("strong");

      marker.className = "visitor-country-key";
      marker.setAttribute("aria-hidden", "true");
      name.textContent = countryName(row.code, feature && feature.properties.name);
      count.textContent = formattedNumber(row.visits);
      count.setAttribute("aria-label", formattedNumber(row.visits) + " visits");

      item.append(marker, name, count);
      countryList.appendChild(item);
    });
  }

  function renderMap(geojson, data) {
    if (!window.d3 || typeof window.d3.geoEqualEarth !== "function") {
      throw new Error("The map library did not load");
    }

    var rows = normalizedRows(data);
    var visitsByCode = new Map(rows.map(function (row) { return [row.code, row.visits]; }));
    var features = (geojson.features || []).filter(function (feature) {
      return feature.properties && feature.properties.iso2 !== "AQ";
    });
    var featureCollection = { type: "FeatureCollection", features: features };
    var featureByCode = new Map();

    features.forEach(function (feature) {
      var code = String(feature.properties.iso2 || "").toUpperCase();
      if (/^[A-Z]{2}$/.test(code) && !featureByCode.has(code)) {
        featureByCode.set(code, feature);
      }
    });

    var projection = window.d3.geoEqualEarth().fitExtent([[24, 18], [936, 482]], featureCollection);
    var path = window.d3.geoPath(projection);
    svg.replaceChildren();

    var title = svgElement("title");
    title.textContent = "All-time website visitors by country or region";
    var description = svgElement("desc");
    description.textContent = "Highlighted countries and bright markers indicate cumulative visits stored by country or region.";
    svg.append(title, description);

    var ocean = svgElement("path", { "class": "visitor-map-ocean", d: path({ type: "Sphere" }) });
    var graticule = svgElement("path", { "class": "visitor-map-graticule", d: path(window.d3.geoGraticule10()) });
    svg.append(ocean, graticule);

    var countriesGroup = svgElement("g", { "class": "visitor-map-countries" });
    features.forEach(function (feature) {
      var code = String(feature.properties.iso2 || "").toUpperCase();
      var visits = visitsByCode.get(code) || 0;
      var countryPath = svgElement("path", {
        "class": "visitor-map-country" + (visits ? " has-visits" : ""),
        d: path(feature),
        "data-country-code": code
      });

      appendTitle(countryPath, countryName(code, feature.properties.name) + ": " + formattedNumber(visits) + " visits");
      countriesGroup.appendChild(countryPath);
    });
    svg.appendChild(countriesGroup);

    var markersGroup = svgElement("g", { "class": "visitor-map-markers" });
    rows.forEach(function (row) {
      var feature = featureByCode.get(row.code);
      if (!feature) {
        return;
      }

      var properties = feature.properties || {};
      var coordinates = [Number(properties.label_x), Number(properties.label_y)];
      if (!coordinates.every(Number.isFinite)) {
        coordinates = window.d3.geoCentroid(feature);
      }

      var point = projection(coordinates);
      if (!point || !point.every(Number.isFinite)) {
        return;
      }

      var radius = Math.min(12, 3.8 + Math.log2(row.visits + 1) * 1.3);
      var markerGroup = svgElement("g", {
        "class": "visitor-map-marker",
        transform: "translate(" + point[0].toFixed(2) + " " + point[1].toFixed(2) + ")"
      });
      var halo = svgElement("circle", { "class": "visitor-map-marker-halo", r: (radius + 5).toFixed(2) });
      var dot = svgElement("circle", { "class": "visitor-map-marker-dot", r: radius.toFixed(2) });
      appendTitle(markerGroup, countryName(row.code, properties.name) + ": " + formattedNumber(row.visits) + " visits");
      markerGroup.append(halo, dot);
      markersGroup.appendChild(markerGroup);
    });
    svg.appendChild(markersGroup);

    var total = rows.reduce(function (sum, row) { return sum + row.visits; }, 0);
    var knownLocations = rows.filter(function (row) { return row.code !== "XX"; }).length;
    totalNode.textContent = formattedNumber(total);
    locationTotalNode.textContent = formattedNumber(knownLocations);
    footerTotalNode.textContent = formattedNumber(total);
    renderCountryList(rows, featureByCode);

    svg.setAttribute("aria-hidden", "false");
    svg.setAttribute("aria-label", formattedNumber(total) + " recorded visits across " + formattedNumber(knownLocations) + " countries or regions");
    host.classList.add("visitor-map-ready");
  }

  async function start() {
    var geojsonPromise = fetchJson(MAP_DATA_URL, { cache: "force-cache" });
    try {
      await recordVisit();
    } catch (recordError) {
      // A read-only backup can still be displayed when recording is unavailable.
    }

    var statistics;
    try {
      statistics = await loadStatistics();
    } catch (statisticsError) {
      statistics = { total_visits: 0, countries: [], source: "unavailable" };
    }

    try {
      var geojson = await geojsonPromise;
      renderMap(geojson, statistics);

      if (statistics.source === "backup") {
        dataNote.textContent = "Live statistics are temporarily unavailable; the latest retained daily backup is shown.";
      } else if (statistics.source === "unavailable") {
        dataNote.textContent = "Visitor totals are temporarily unavailable; the world map remains visible.";
      } else {
        dataNote.textContent = "Live cumulative totals loaded from persistent storage.";
      }
    } catch (mapError) {
      status.textContent = "The visitor map is temporarily unavailable. Please try again later.";
      host.classList.add("visitor-map-error");
      dataNote.textContent = "Stored visitor totals have not been deleted; only the map display failed to load.";
    }
  }

  start();
}());
