import { execFileSync, spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";

const GTFS_URL =
  process.env.VBB_GTFS_URL ??
  "https://unternehmen.vbb.de/fileadmin/user_upload/VBB/Dokumente/API-Datensaetze/gtfs-mastscharf/GTFS.zip";
const LINE_COLORS_URL =
  process.env.VBB_LINE_COLORS_URL ??
  "https://unternehmen.vbb.de/fileadmin/user_upload/VBB/Dokumente/API-Datensaetze/linienfarben.zip";

const rootDir = new URL("..", import.meta.url).pathname;
const cacheDir = join(rootDir, ".cache", "transit");
const outputPath = join(rootDir, "apps", "web", "public", "transit", "berlin-transit.geojson");

const REFERENCE_MAP_ROUTE_REFS = new Set([
  "S1",
  "S2",
  "S3",
  "S5",
  "S7",
  "S8",
  "S9",
  "S15",
  "S25",
  "S26",
  "S41",
  "S42",
  "S45",
  "S46",
  "S47",
  "S75",
  "S85",
  "U1",
  "U2",
  "U3",
  "U4",
  "U5",
  "U6",
  "U7",
  "U8",
  "U9",
]);

function parseCsv(text, delimiter = ",") {
  const rows = [];
  let field = "";
  let row = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [headers = [], ...dataRows] = rows;
  return dataRows
    .filter((dataRow) => dataRow.some((value) => value.trim()))
    .map((dataRow) =>
      Object.fromEntries(headers.map((header, index) => [header.trim(), dataRow[index]?.trim() ?? ""])),
    );
}

function parseCsvLine(line) {
  const values = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      values.push(field);
      field = "";
    } else {
      field += char;
    }
  }

  values.push(field);
  return values;
}

function zipEntry(zipPath, entryName) {
  return execFileSync("unzip", ["-p", zipPath, entryName], {
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
  });
}

async function forEachZipCsvRow(zipPath, entryName, callback) {
  const child = spawn("unzip", ["-p", zipPath, entryName], {
    stdio: ["ignore", "pipe", "inherit"],
  });
  const closePromise = new Promise((resolve, reject) => {
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Failed to read ${entryName} from ${zipPath}; unzip exited with code ${code}`));
      }
    });
    child.on("error", reject);
  });
  const lines = createInterface({
    crlfDelay: Infinity,
    input: child.stdout,
  });
  let headers = null;

  for await (const line of lines) {
    if (!headers) {
      headers = parseCsvLine(line).map((header) => header.trim());
      continue;
    }
    if (!line.trim()) {
      continue;
    }
    const values = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""]));
    await callback(row);
  }

  await closePromise;
}

function listZipEntries(zipPath) {
  return execFileSync("unzip", ["-Z1", zipPath], {
    encoding: "utf8",
  })
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function download(url, targetPath) {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  await finished(Readable.fromWeb(response.body).pipe(createWriteStream(targetPath)));
}

function normalizeColor(value) {
  const cleaned = value.trim().replace(/^#/, "");
  return /^[0-9a-f]{6}$/i.test(cleaned) ? `#${cleaned.toUpperCase()}` : null;
}

function buildLineColorLookup(rows) {
  const lookup = new Map();
  for (const row of rows) {
    const entries = Object.entries(row);
    const lineValue = entries.find(([key]) => /^(linie|line|name|route|kurzname|short)/i.test(key))?.[1];
    const colorValue =
      entries.find(([key]) => /(^|_|-)(hex|background_hex)$/i.test(key))?.[1] ??
      entries.find(([key]) => /(color|colour)/i.test(key))?.[1];
    const color = colorValue ? normalizeColor(colorValue) : null;
    if (lineValue && color) {
      lookup.set(lineValue.replace(/\s+/g, "").toUpperCase(), color);
    }
  }
  return lookup;
}

function routeLabel(route) {
  return (route.route_short_name || route.route_long_name || route.route_id).trim();
}

function isBerlinRailRoute(route) {
  const label = routeLabel(route).replace(/\s+/g, "").toUpperCase();
  return REFERENCE_MAP_ROUTE_REFS.has(label);
}

function routeMode(route) {
  return routeLabel(route).replace(/\s+/g, "").toUpperCase().startsWith("U") ? "u-bahn" : "s-bahn";
}

function berlinBoundsContains(lon, lat) {
  return lon >= 13.0 && lon <= 13.85 && lat >= 52.3 && lat <= 52.75;
}

function roundedCoordinateKey(lon, lat) {
  return `${lon.toFixed(6)},${lat.toFixed(6)}`;
}

function lineFeature(route, shapeId, coordinates, color) {
  return {
    geometry: {
      coordinates,
      type: "LineString",
    },
    properties: {
      color,
      mode: routeMode(route),
      routeId: route.route_id,
      shapeId,
      title: route.route_long_name || routeLabel(route),
      ref: routeLabel(route),
    },
    type: "Feature",
  };
}

function stationFeature(stop, routeRefs, routeColors) {
  const lon = Number(stop.stop_lon);
  const lat = Number(stop.stop_lat);
  return {
    geometry: {
      coordinates: [lon, lat],
      type: "Point",
    },
    properties: {
      colors: [...routeColors],
      mode: [...routeRefs].some((ref) => ref.startsWith("U")) ? "u-bahn" : "s-bahn",
      name: stop.stop_name,
      refs: [...routeRefs].sort(),
      stopId: stop.stop_id,
    },
    type: "Feature",
  };
}

const CANONICAL_ROUTE_STATIONS = {
  S2: [
    "S Bernau Bhf",
    "S Bernau-Friedenstal",
    "S Zepernick",
    "S Röntgental",
    "S Buch (Berlin)",
    "S Karow Bhf (Berlin)",
    "S Blankenburg (Berlin)",
    "S Pankow-Heinersdorf (Berlin)",
    "S+U Pankow (Berlin)",
    "S Bornholmer Str. (Berlin)",
    "S+U Gesundbrunnen Bhf (Berlin)",
    "S Humboldthain (Berlin)",
    "S Nordbahnhof (Berlin)",
    "S Oranienburger Str. (Berlin)",
    "S+U Friedrichstr. Bhf (Berlin)",
    "S+U Brandenburger Tor (Berlin)",
    "S+U Potsdamer Platz Bhf (Berlin)",
    "S Anhalter Bahnhof (Berlin)",
    "S+U Yorckstr. (Berlin)",
    "S Südkreuz Bhf (Berlin)",
    "S Priesterweg (Berlin)",
    "S Attilastr. (Berlin)",
    "S Marienfelde (Berlin)",
    "S Buckower Chaussee (Berlin)",
    "S Schichauweg (Berlin)",
    "S Lichtenrade (Berlin)",
    "S Mahlow",
    "S Blankenfelde (TF) Bhf",
  ],
  S25: [
    "S Hennigsdorf Bhf",
    "S Heiligensee (Berlin)",
    "S Schulzendorf (Berlin)",
    "S Tegel (Berlin)",
    "S Eichborndamm (Berlin)",
    "S+U Karl-Bonhoeffer-Nervenklinik (Berlin)",
    "S Alt-Reinickendorf (Berlin)",
    "S Schönholz (Berlin)",
    "S Wollankstr. (Berlin)",
    "S Bornholmer Str. (Berlin)",
    "S+U Gesundbrunnen Bhf (Berlin)",
    "S Humboldthain (Berlin)",
    "S Nordbahnhof (Berlin)",
    "S Oranienburger Str. (Berlin)",
    "S+U Friedrichstr. Bhf (Berlin)",
    "S+U Brandenburger Tor (Berlin)",
    "S+U Potsdamer Platz Bhf (Berlin)",
    "S Anhalter Bahnhof (Berlin)",
    "S+U Yorckstr. (Berlin)",
    "S Südkreuz Bhf (Berlin)",
    "S Priesterweg (Berlin)",
    "S Südende (Berlin)",
    "S Lankwitz (Berlin)",
    "S Lichterfelde Ost Bhf (Berlin)",
    "S Osdorfer Str. (Berlin)",
    "S Lichterfelde Süd (Berlin)",
    "S Teltow Stadt",
  ],
  S41: [
    "S+U Gesundbrunnen Bhf (Berlin)",
    "S+U Schönhauser Allee (Berlin)",
    "S Prenzlauer Allee (Berlin)",
    "S Greifswalder Str. (Berlin)",
    "S Landsberger Allee (Berlin)",
    "S Storkower Str. (Berlin)",
    "S+U Frankfurter Allee (Berlin)",
    "S Ostkreuz Bhf (Berlin)",
    "S Treptower Park (Berlin)",
    "S Sonnenallee (Berlin)",
    "S+U Neukölln (Berlin)",
    "S+U Hermannstr. (Berlin)",
    "S+U Tempelhof (Berlin)",
    "S Südkreuz Bhf (Berlin)",
    "S Schöneberg (Berlin)",
    "S+U Innsbrucker Platz (Berlin)",
    "S+U Bundesplatz (Berlin)",
    "S+U Heidelberger Platz (Berlin)",
    "S Hohenzollerndamm (Berlin)",
    "S Halensee (Berlin)",
    "S Westkreuz (Berlin)",
    "S Messe Nord/ZOB (Berlin)",
    "S Westend (Berlin)",
    "S+U Jungfernheide Bhf (Berlin)",
    "S Beusselstr. (Berlin)",
    "S+U Westhafen (Berlin)",
    "S+U Wedding (Berlin)",
  ],
  S42: [
    "S+U Gesundbrunnen Bhf (Berlin)",
    "S+U Wedding (Berlin)",
    "S+U Westhafen (Berlin)",
    "S Beusselstr. (Berlin)",
    "S+U Jungfernheide Bhf (Berlin)",
    "S Westend (Berlin)",
    "S Messe Nord/ZOB (Berlin)",
    "S Westkreuz (Berlin)",
    "S Halensee (Berlin)",
    "S Hohenzollerndamm (Berlin)",
    "S+U Heidelberger Platz (Berlin)",
    "S+U Bundesplatz (Berlin)",
    "S+U Innsbrucker Platz (Berlin)",
    "S Schöneberg (Berlin)",
    "S Südkreuz Bhf (Berlin)",
    "S+U Tempelhof (Berlin)",
    "S+U Hermannstr. (Berlin)",
    "S+U Neukölln (Berlin)",
    "S Sonnenallee (Berlin)",
    "S Treptower Park (Berlin)",
    "S Ostkreuz Bhf (Berlin)",
    "S+U Frankfurter Allee (Berlin)",
    "S Storkower Str. (Berlin)",
    "S Landsberger Allee (Berlin)",
    "S Greifswalder Str. (Berlin)",
    "S Prenzlauer Allee (Berlin)",
    "S+U Schönhauser Allee (Berlin)",
  ],
};

const CANONICAL_LINE_RULES = {
  S2: {
    requiredStations: ["S Bernau Bhf", "S Blankenfelde (TF) Bhf"],
    rejectedStations: ["S Schöneweide Bhf (Berlin)", "S Wildau", "S Zeuthen"],
  },
  S25: {
    requiredStations: ["S Hennigsdorf Bhf", "S Teltow Stadt"],
    rejectedStations: ["S Schöneweide Bhf (Berlin)", "S Spindlersfeld (Berlin)"],
  },
  S41: {
    closed: true,
    requiredStations: ["S+U Gesundbrunnen Bhf (Berlin)", "S Ostkreuz Bhf (Berlin)", "S Südkreuz Bhf (Berlin)", "S Westkreuz (Berlin)"],
    rejectedStations: ["S Bornholmer Str. (Berlin)", "S Schöneweide Bhf (Berlin)", "S Grünau (Berlin)"],
  },
  S42: {
    closed: true,
    requiredStations: ["S+U Gesundbrunnen Bhf (Berlin)", "S Ostkreuz Bhf (Berlin)", "S Südkreuz Bhf (Berlin)", "S Westkreuz (Berlin)"],
    rejectedStations: ["S Baumschulenweg (Berlin)", "S Schöneweide Bhf (Berlin)", "S Grünau (Berlin)"],
  },
};

const STATION_TOUCH_TOLERANCE = 0.01;
const REJECTED_STATION_TOUCH_TOLERANCE = 0.002;

function featureLength(feature) {
  let total = 0;
  const coordinates = feature.geometry.coordinates;
  for (let index = 1; index < coordinates.length; index += 1) {
    const [prevLng, prevLat] = coordinates[index - 1];
    const [lng, lat] = coordinates[index];
    total += Math.hypot(lng - prevLng, lat - prevLat);
  }
  return total;
}

function coordinateDistance(left, right) {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}

function lineTouchesCoordinate(feature, coordinate, tolerance = STATION_TOUCH_TOLERANCE) {
  return feature.geometry.coordinates.some((lineCoordinate) => coordinateDistance(lineCoordinate, coordinate) < tolerance);
}

function isClosedLine(feature) {
  const coordinates = feature.geometry.coordinates;
  const first = coordinates[0];
  const last = coordinates.at(-1);
  return Boolean(first && last && coordinateDistance(first, last) < 0.001);
}

function findStopCoordinateByName(stops, stationName) {
  const stop = stops.find((candidate) => candidate.stop_name === stationName);
  if (!stop) {
    return null;
  }
  const lon = Number(stop.stop_lon);
  const lat = Number(stop.stop_lat);
  return Number.isFinite(lon) && Number.isFinite(lat) ? [lon, lat] : null;
}

function matchesCanonicalLineRule(feature, rule, stops) {
  if (rule.closed && !isClosedLine(feature)) {
    return false;
  }

  return (
    rule.requiredStations.every((stationName) => {
      const coordinate = findStopCoordinateByName(stops, stationName);
      return coordinate && lineTouchesCoordinate(feature, coordinate);
    }) &&
    rule.rejectedStations.every((stationName) => {
      const coordinate = findStopCoordinateByName(stops, stationName);
      return !coordinate || !lineTouchesCoordinate(feature, coordinate, REJECTED_STATION_TOUCH_TOLERANCE);
    })
  );
}

function selectCanonicalLineFeatures(features, stops) {
  const replacements = new Map();

  for (const [ref, rule] of Object.entries(CANONICAL_LINE_RULES)) {
    const candidates = features.filter(
      (feature) => feature.geometry.type === "LineString" && feature.properties.ref === ref && matchesCanonicalLineRule(feature, rule, stops),
    );
    if (!candidates.length) {
      console.warn(`No canonical ${ref} shape matched; keeping all generated ${ref} shapes.`);
      continue;
    }
    replacements.set(
      ref,
      candidates.reduce((best, current) => (featureLength(current) > featureLength(best) ? current : best)),
    );
  }

  return features.filter((feature) => {
    if (feature.geometry.type !== "LineString" || !replacements.has(feature.properties.ref)) {
      return true;
    }
    return feature === replacements.get(feature.properties.ref);
  });
}

function applyCanonicalStationRefs(stationRefsByStopId, stops) {
  const canonicalRefsByStationName = new Map(
    Object.entries(CANONICAL_ROUTE_STATIONS).map(([ref, stationNames]) => [ref, new Set(stationNames)]),
  );
  const canonicalRefs = new Set(canonicalRefsByStationName.keys());

  for (const stop of stops) {
    const refs = stationRefsByStopId.get(stop.stop_id);
    if (!refs) {
      continue;
    }
    for (const ref of canonicalRefs) {
      refs.delete(ref);
    }
  }

  for (const stop of stops) {
    for (const [ref, stationNames] of canonicalRefsByStationName) {
      if (!stationNames.has(stop.stop_name)) {
        continue;
      }
      const refs = stationRefsByStopId.get(stop.stop_id) ?? new Set();
      refs.add(ref);
      stationRefsByStopId.set(stop.stop_id, refs);
    }
  }
}

async function main() {
  await mkdir(cacheDir, { recursive: true });
  await mkdir(join(rootDir, "apps", "web", "public", "transit"), { recursive: true });

  const gtfsPath = join(cacheDir, basename(new URL(GTFS_URL).pathname));
  const lineColorsPath = join(cacheDir, basename(new URL(LINE_COLORS_URL).pathname));
  await rm(gtfsPath, { force: true });
  await rm(lineColorsPath, { force: true });

  console.log("Downloading VBB GTFS...");
  await download(GTFS_URL, gtfsPath);
  console.log("Downloading VBB line colors...");
  await download(LINE_COLORS_URL, lineColorsPath);

  const colorEntry = listZipEntries(lineColorsPath).find((entry) => entry.toLowerCase().endsWith(".csv"));
  const lineColorLookup = colorEntry ? buildLineColorLookup(parseCsv(zipEntry(lineColorsPath, colorEntry), ";")) : new Map();

  const routes = parseCsv(zipEntry(gtfsPath, "routes.txt")).filter(isBerlinRailRoute);
  const routeById = new Map(routes.map((route) => [route.route_id, route]));
  const routeByLabel = new Map(routes.map((route) => [routeLabel(route).replace(/\s+/g, "").toUpperCase(), route]));
  const colorForLabel = (label) => {
    const normalizedLabel = label.replace(/\s+/g, "").toUpperCase();
    const route = routeByLabel.get(normalizedLabel);
    return (
      lineColorLookup.get(normalizedLabel) ??
      normalizeColor(route?.route_color ?? "") ??
      (normalizedLabel.startsWith("S") ? "#008A4B" : "#006CB7")
    );
  };
  const stops = parseCsv(zipEntry(gtfsPath, "stops.txt"));
  const stopById = new Map(stops.map((stop) => [stop.stop_id, stop]));
  const tripRouteById = new Map();
  const shapeIds = new Set();
  const routeIdsByShapeId = new Map();

  console.log("Reading selected U-Bahn/S-Bahn trips...");
  await forEachZipCsvRow(gtfsPath, "trips.txt", async (trip) => {
    if (!routeById.has(trip.route_id)) {
      return;
    }
    tripRouteById.set(trip.trip_id, trip.route_id);
    if (!trip.shape_id) {
      return;
    }
    shapeIds.add(trip.shape_id);
    const routeIds = routeIdsByShapeId.get(trip.shape_id) ?? new Set();
    routeIds.add(trip.route_id);
    routeIdsByShapeId.set(trip.shape_id, routeIds);
  });

  const shapePointsById = new Map();

  console.log("Reading selected U-Bahn/S-Bahn shapes...");
  await forEachZipCsvRow(gtfsPath, "shapes.txt", async (row) => {
    if (!shapeIds.has(row.shape_id)) {
      return;
    }
    const lat = Number(row.shape_pt_lat);
    const lon = Number(row.shape_pt_lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return;
    }
    const points = shapePointsById.get(row.shape_id) ?? [];
    points.push({
      coordinates: [lon, lat],
      sequence: Number(row.shape_pt_sequence),
    });
    shapePointsById.set(row.shape_id, points);
  });

  const features = [];
  const seenLineGeometries = new Set();

  for (const [shapeId, points] of shapePointsById) {
    const routeId = [...(routeIdsByShapeId.get(shapeId) ?? [])][0];
    const route = routeId ? routeById.get(routeId) : null;
    if (!route || points.length < 2) {
      continue;
    }
    const sortedCoordinates = points
      .sort((left, right) => left.sequence - right.sequence)
      .map((point) => point.coordinates)
      .filter(([lon, lat]) => berlinBoundsContains(lon, lat));
    if (sortedCoordinates.length < 2) {
      continue;
    }
    const key = `${route.route_id}:${sortedCoordinates.map(([lon, lat]) => roundedCoordinateKey(lon, lat)).join("|")}`;
    if (seenLineGeometries.has(key)) {
      continue;
    }
    seenLineGeometries.add(key);
    const label = routeLabel(route).replace(/\s+/g, "").toUpperCase();
    features.push(lineFeature(route, shapeId, sortedCoordinates, colorForLabel(label)));
  }

  const canonicalLineFeatures = selectCanonicalLineFeatures(features, stops);
  features.length = 0;
  features.push(...canonicalLineFeatures);

  const stationRefsByStopId = new Map();

  console.log("Reading selected U-Bahn/S-Bahn stop times...");
  await forEachZipCsvRow(gtfsPath, "stop_times.txt", async (row) => {
    const routeId = tripRouteById.get(row.trip_id);
    const route = routeId ? routeById.get(routeId) : null;
    const stop = stopById.get(row.stop_id);
    if (!route || !stop) {
      return;
    }
    const lat = Number(stop.stop_lat);
    const lon = Number(stop.stop_lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !berlinBoundsContains(lon, lat)) {
      return;
    }
    const refs = stationRefsByStopId.get(stop.stop_id) ?? new Set();
    const label = routeLabel(route).replace(/\s+/g, "").toUpperCase();
    refs.add(label);
    stationRefsByStopId.set(stop.stop_id, refs);
  });

  applyCanonicalStationRefs(stationRefsByStopId, stops);

  for (const [stopId, refs] of stationRefsByStopId) {
    const stop = stopById.get(stopId);
    if (!stop) {
      continue;
    }
    features.push(stationFeature(stop, refs, new Set([...refs].map(colorForLabel))));
  }

  const collection = {
    attribution: "VBB Verkehrsverbund Berlin-Brandenburg GmbH",
    features,
    generatedAt: new Date().toISOString(),
    source: {
      gtfs: GTFS_URL,
      lineColors: LINE_COLORS_URL,
    },
    type: "FeatureCollection",
  };

  await writeFile(outputPath, `${JSON.stringify(collection)}\n`);
  const output = await readFile(outputPath, "utf8");
  console.log(`Wrote ${features.length} transit features to ${outputPath} (${Math.round(output.length / 1024)} KB)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
