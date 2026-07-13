"use strict";

const fs = require("node:fs");
const path = require("node:path");

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath || !outputPath) {
  console.error("Usage: node scripts/prepare-world-map.js <input.geojson> <output.geojson>");
  process.exit(1);
}

function validIso2(value) {
  const code = String(value || "").toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : "";
}

function countryCode(properties) {
  return validIso2(properties.ISO_A2_EH) ||
    validIso2(properties.ISO_A2) ||
    validIso2(properties.WB_A2);
}

function roundedCoordinates(value) {
  if (Array.isArray(value)) {
    return value.map(roundedCoordinates);
  }

  if (typeof value === "number") {
    return Math.round(value * 1000) / 1000;
  }

  return value;
}

const source = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const features = (source.features || []).map((feature) => {
  const properties = feature.properties || {};
  const labelX = Number(properties.LABEL_X);
  const labelY = Number(properties.LABEL_Y);

  return {
    type: "Feature",
    properties: {
      iso2: countryCode(properties),
      name: properties.NAME_EN || properties.ADMIN || properties.NAME || "Unknown region",
      label_x: Number.isFinite(labelX) ? labelX : null,
      label_y: Number.isFinite(labelY) ? labelY : null
    },
    geometry: {
      type: feature.geometry.type,
      coordinates: roundedCoordinates(feature.geometry.coordinates)
    }
  };
});

const result = {
  type: "FeatureCollection",
  source: "Natural Earth ne_110m_admin_0_countries",
  features
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(result)}\n`, "utf8");
console.log(`Prepared ${features.length} country features at ${outputPath}`);
