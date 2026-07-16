import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type TransitFeature = {
  geometry:
    | { coordinates: [number, number]; type: "Point" }
    | { coordinates: Array<[number, number]>; type: "LineString" };
  properties: {
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
});
