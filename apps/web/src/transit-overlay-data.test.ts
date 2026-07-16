import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type TransitFeature = {
  geometry:
    | { coordinates: [number, number]; type: "Point" }
    | { coordinates: Array<[number, number]>; type: "LineString" };
  properties: {
    color?: string;
    name?: string;
    ref?: string;
    refs?: string[];
  };
  type: "Feature";
};

type TransitFeatureCollection = {
  features: TransitFeature[];
  type: "FeatureCollection";
};

const referenceMapRouteRefs = new Set([
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

const transitData = JSON.parse(
  readFileSync(resolve("apps/web/public/transit/berlin-transit.geojson"), "utf8"),
) as TransitFeatureCollection;

function lineLength(coordinates: Array<[number, number]>) {
  let total = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    const [prevLng, prevLat] = coordinates[index - 1];
    const [lng, lat] = coordinates[index];
    total += Math.hypot(lng - prevLng, lat - prevLat);
  }
  return total;
}

function selectedLine(ref: string) {
  const lines = transitData.features.filter(
    (feature): feature is TransitFeature & { geometry: { coordinates: Array<[number, number]>; type: "LineString" } } =>
      feature.geometry.type === "LineString" && feature.properties.ref === ref,
  );
  return lines.reduce((best, current) => (lineLength(current.geometry.coordinates) > lineLength(best.geometry.coordinates) ? current : best));
}

function stationCoordinates(name: string) {
  const station = transitData.features.find(
    (feature): feature is TransitFeature & { geometry: { coordinates: [number, number]; type: "Point" } } =>
      feature.geometry.type === "Point" && feature.properties.name === name,
  );
  if (!station) {
    throw new Error(`Missing transit station ${name}`);
  }
  return station.geometry.coordinates;
}

function distance(left: [number, number], right: [number, number]) {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}

function lineTouchesStation(ref: string, stationName: string) {
  const line = selectedLine(ref);
  const station = stationCoordinates(stationName);
  return line.geometry.coordinates.some((coordinate) => distance(coordinate, station) < 0.01);
}

function stationRefs(name: string) {
  const station = transitData.features.find((feature) => feature.geometry.type === "Point" && feature.properties.name === name);
  return station?.properties.refs ?? [];
}

describe("Berlin transit overlay data", () => {
  it("only includes line refs present on the reference map", () => {
    const lineRefs = new Set(
      transitData.features.flatMap((feature) =>
        feature.geometry.type === "LineString" && feature.properties.ref ? [feature.properties.ref] : feature.properties.refs ?? [],
      ),
    );

    expect([...lineRefs].filter((ref) => !referenceMapRouteRefs.has(ref)).sort()).toEqual([]);
  });

  it("uses VBB reference line colors for S-Bahn routes", () => {
    const colors = new Map(
      transitData.features
        .filter((feature) => feature.geometry.type === "LineString" && feature.properties.ref)
        .map((feature) => [feature.properties.ref, feature.properties.color]),
    );

    expect(colors.get("S1")).toBe("#DA6BA2");
    expect(colors.get("S2")).toBe("#007734");
    expect(colors.get("S3")).toBe("#0066AD");
    expect(colors.get("S5")).toBe("#EB7405");
    expect(colors.get("S7")).toBe("#816DA6");
    expect(colors.get("S8")).toBe("#66AA22");
    expect(colors.get("S9")).toBe("#992746");
    expect(colors.get("S41")).toBe("#AD5937");
    expect(colors.get("S42")).toBe("#CB6418");
    expect(colors.get("S46")).toBe("#CD9C53");
  });

  it("keeps S2 on the Bernau to Blankenfelde north-south route", () => {
    expect(lineTouchesStation("S2", "S Bernau Bhf")).toBe(true);
    expect(lineTouchesStation("S2", "S Blankenfelde (TF) Bhf")).toBe(true);
    expect(lineTouchesStation("S2", "S Schöneweide Bhf (Berlin)")).toBe(false);
    expect(stationRefs("S Schöneweide Bhf (Berlin)")).not.toContain("S2");
  });

  it("keeps S25 on the Hennigsdorf to Teltow Stadt north-south route", () => {
    expect(lineTouchesStation("S25", "S Hennigsdorf Bhf")).toBe(true);
    expect(lineTouchesStation("S25", "S Teltow Stadt")).toBe(true);
    expect(lineTouchesStation("S25", "S Schöneweide Bhf (Berlin)")).toBe(false);
    expect(stationRefs("S Schöneweide Bhf (Berlin)")).not.toContain("S25");
  });

  it("keeps S41 as a closed Ringbahn service", () => {
    const line = selectedLine("S41");
    const first = line.geometry.coordinates[0];
    const last = line.geometry.coordinates.at(-1);

    expect(first && last && distance(first, last)).toBeLessThan(0.001);
    expect(lineTouchesStation("S41", "S Schöneweide Bhf (Berlin)")).toBe(false);
    expect(stationRefs("S Schöneweide Bhf (Berlin)")).not.toContain("S41");
    expect(stationRefs("S Bornholmer Str. (Berlin)")).not.toContain("S41");
  });

  it("keeps S42 as a closed Ringbahn service", () => {
    const line = selectedLine("S42");
    const first = line.geometry.coordinates[0];
    const last = line.geometry.coordinates.at(-1);

    expect(first && last && distance(first, last)).toBeLessThan(0.001);
    expect(lineTouchesStation("S42", "S Baumschulenweg (Berlin)")).toBe(false);
    expect(lineTouchesStation("S42", "S Schöneweide Bhf (Berlin)")).toBe(false);
    expect(stationRefs("S Baumschulenweg (Berlin)")).not.toContain("S42");
    expect(stationRefs("S Schöneweide Bhf (Berlin)")).not.toContain("S42");
  });
});
