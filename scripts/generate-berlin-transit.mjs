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

function parseCsv(text) {
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
    } else if (char === ",") {
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
    const colorValue = entries.find(([key]) => /(farbe|color|colour|hex)/i.test(key))?.[1];
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
  return /^U\d/.test(label) || /^S\d/.test(label);
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
  const lineColorLookup = colorEntry ? buildLineColorLookup(parseCsv(zipEntry(lineColorsPath, colorEntry))) : new Map();

  const routes = parseCsv(zipEntry(gtfsPath, "routes.txt")).filter(isBerlinRailRoute);
  const routeById = new Map(routes.map((route) => [route.route_id, route]));
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
    const color = lineColorLookup.get(label) ?? normalizeColor(route.route_color) ?? (label.startsWith("S") ? "#008A4B" : "#006CB7");
    features.push(lineFeature(route, shapeId, sortedCoordinates, color));
  }

  const stationRefsByStopId = new Map();
  const stationColorsByStopId = new Map();

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
    const colors = stationColorsByStopId.get(stop.stop_id) ?? new Set();
    const label = routeLabel(route).replace(/\s+/g, "").toUpperCase();
    refs.add(label);
    colors.add(lineColorLookup.get(label) ?? normalizeColor(route.route_color) ?? (label.startsWith("S") ? "#008A4B" : "#006CB7"));
    stationRefsByStopId.set(stop.stop_id, refs);
    stationColorsByStopId.set(stop.stop_id, colors);
  });

  for (const [stopId, refs] of stationRefsByStopId) {
    const stop = stopById.get(stopId);
    if (!stop) {
      continue;
    }
    features.push(stationFeature(stop, refs, stationColorsByStopId.get(stopId) ?? new Set()));
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
