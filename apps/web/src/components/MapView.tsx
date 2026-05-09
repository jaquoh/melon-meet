import { Info, TrainFront } from "lucide-react";
import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import type { GroupSummary, MeetingSummary, VenueSummary } from "../../../../packages/shared/src";

interface BoundsValue {
  east: number;
  north: number;
  south: number;
  west: number;
}

interface GroupPin {
  filteredSessionCount: number;
  group: GroupSummary;
  latitude: number;
  longitude: number;
  nextMeeting: MeetingSummary | null;
}

interface MapViewProps {
  groupPins?: GroupPin[];
  meetings: MeetingSummary[];
  mode: "groups" | "sessions" | "venues";
  onBackgroundClick?: () => void;
  onBoundsChange: (bounds: BoundsValue) => void;
  onGroupSelect?: (group: GroupSummary) => void;
  onMeetingClusterSelect?: (payload: { lookupKey: string; meetings: MeetingSummary[]; title: string }) => void;
  onMeetingSelect: (meeting: MeetingSummary) => void;
  onVenueSelect: (venue: VenueSummary) => void;
  selectionRevision?: number;
  selectedKey?: string | null;
  selectedLocation?: { id: string; latitude: number; longitude: number } | null;
  theme: "dark" | "light";
  venueMeetingsById?: Record<string, MeetingSummary[]>;
  venues: VenueSummary[];
  visible?: boolean;
}

type SelectedMarkerKey = null | string;

type MarkerLookupEntry =
  | { kind: "group"; group: GroupSummary; popupLines: string[]; popupTitle: string }
  | { kind: "session-cluster"; meetings: MeetingSummary[]; popupLines: string[]; popupTitle: string; lookupKey: string }
  | { kind: "session"; meeting: MeetingSummary; popupLines: string[]; popupTitle: string }
  | { kind: "venue"; popupLines: string[]; popupTitle: string; venue: VenueSummary };

type SimpleFeature = {
  geometry: { coordinates: [number, number]; type: "Point" };
  properties: {
    attending: 0 | 1;
    badge: string;
    badgeIcon: string;
    cornerIcon: string;
    icon: string;
    kind: "group" | "session" | "venue";
    label: string;
    lookupKey: string;
    owner: 0 | 1;
    private: 0 | 1;
    selected: 0 | 1;
  };
  type: "Feature";
};

type SimpleFeatureCollection = {
  features: SimpleFeature[];
  type: "FeatureCollection";
};

type TransitFeatureCollection = {
  features: Array<{
    geometry:
      | { coordinates: [number, number]; type: "Point" }
      | { coordinates: Array<[number, number]>; type: "LineString" };
    id?: number | string;
    properties: {
      color?: string;
      colors?: string[];
      labelIcon?: string;
      mode?: "s-bahn" | "u-bahn";
      name?: string;
      ref?: string;
      refs?: string[];
      stopId?: string;
    };
    type: "Feature";
  }>;
  type: "FeatureCollection";
};

const BERLIN_CENTER: [number, number] = [13.405, 52.52];
const SOURCE_ID = "melon-map-items";
const CLUSTER_LAYER_ID = "melon-map-clusters";
const CLUSTER_COUNT_LAYER_ID = "melon-map-cluster-count";
const VENUE_SOURCE_ID = "melon-map-venues";
const VENUE_CLUSTER_LAYER_ID = "melon-map-venue-clusters";
const VENUE_CLUSTER_COUNT_LAYER_ID = "melon-map-venue-cluster-count";
const VENUE_BASE_LAYER_ID = "melon-map-venue-base";
const VENUE_ICON_LAYER_ID = "melon-map-venue-icon";
const VENUE_BADGE_LAYER_ID = "melon-map-venue-badge";
const VENUE_LABEL_LAYER_ID = "melon-map-venue-label";
const VENUE_HIT_LAYER_ID = "melon-map-venue-hit";
const LAYER_BASE_ID = "melon-map-base";
const LAYER_ICON_ID = "melon-map-icon";
const LAYER_BADGE_ID = "melon-map-badge";
const LAYER_CORNER_ID = "melon-map-corner";
const LAYER_LABEL_ID = "melon-map-label";
const LAYER_HIT_ID = "melon-map-hit";
const TRANSIT_SOURCE_ID = "berlin-transit-overlay";
const TRANSIT_LINE_LAYER_ID = "berlin-transit-lines";
const TRANSIT_LINE_HIGHLIGHT_LAYER_ID = "berlin-transit-lines-highlight";
const TRANSIT_LINE_LABEL_LAYER_ID = "berlin-transit-line-labels";
const TRANSIT_LINE_LABEL_HIGHLIGHT_LAYER_ID = "berlin-transit-line-labels-highlight";
const TRANSIT_STATION_HALO_LAYER_ID = "berlin-transit-station-halo";
const TRANSIT_STATION_DOT_LAYER_ID = "berlin-transit-station-dot";
const TRANSIT_STATION_DOT_HIGHLIGHT_LAYER_ID = "berlin-transit-station-dot-highlight";
const TRANSIT_STATION_LABEL_LAYER_ID = "berlin-transit-station-label";
const TRANSIT_STATION_LABEL_ROUTE_HIGHLIGHT_LAYER_ID = "berlin-transit-station-label-route-highlight";
const TRANSIT_STATION_LABEL_HIGHLIGHT_LAYER_ID = "berlin-transit-station-label-highlight";
const DEFAULT_LIGHT_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const DEFAULT_DARK_STYLE = "https://tiles.openfreemap.org/styles/dark";
const TRANSIT_OVERLAY_URL = "/transit/berlin-transit.geojson";
const SELECTED_MARKER_ZOOM = 13.4;
const MAP_ATTRIBUTION_PLACEMENT = "bottom-right" as const;

type MapAttributionPlacement = "bottom-left" | "bottom-right";
type TransitLineRef = string;
type TransitStationKey = string;

const TRANSIT_LAYER_IDS = [
  TRANSIT_LINE_LAYER_ID,
  TRANSIT_LINE_HIGHLIGHT_LAYER_ID,
  TRANSIT_LINE_LABEL_LAYER_ID,
  TRANSIT_LINE_LABEL_HIGHLIGHT_LAYER_ID,
  TRANSIT_STATION_HALO_LAYER_ID,
  TRANSIT_STATION_DOT_LAYER_ID,
  TRANSIT_STATION_DOT_HIGHLIGHT_LAYER_ID,
  TRANSIT_STATION_LABEL_LAYER_ID,
  TRANSIT_STATION_LABEL_ROUTE_HIGHLIGHT_LAYER_ID,
  TRANSIT_STATION_LABEL_HIGHLIGHT_LAYER_ID,
] as const;

function transitLineLabelIconId(mode: "s-bahn" | "u-bahn" | undefined, ref: string) {
  return `transit-line-label-${mode ?? "rail"}-${ref.replace(/[^a-z0-9]/gi, "").toLowerCase()}`;
}

function transitLineLabelText(ref: string) {
  if (ref === "S41") {
    return "S41 >";
  }
  if (ref === "S42") {
    return "< S42";
  }
  return ref;
}

function escapeSvgText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function transitStationKeyFromName(name: string) {
  return `name:${name}` as TransitStationKey;
}

function transitLineLength(coordinates: Array<[number, number]>) {
  let total = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    const [prevLng, prevLat] = coordinates[index - 1];
    const [lng, lat] = coordinates[index];
    total += Math.hypot(lng - prevLng, lat - prevLat);
  }
  return total;
}

function transitLineLabelSvg(mode: "s-bahn" | "u-bahn" | undefined, ref: string) {
  const label = transitLineLabelText(ref);
  const safeLabel = escapeSvgText(label);
  const logoFill = mode === "s-bahn" ? "#0B8F43" : "#0A62C9";
  const textWidth = Math.max(22, Math.round(label.length * 6.2 + 8));
  const width = 21 + 4 + textWidth + 5;
  const pixelWidth = width * 2;
  const pixelHeight = 40;
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${pixelWidth}" height="${pixelHeight}" viewBox="0 0 ${width} 20" fill="none">
      <rect x="0.75" y="0.75" width="${width - 1.5}" height="18.5" rx="9.25" fill="rgba(255,250,245,0.72)" stroke="rgba(113,132,142,0.32)" stroke-width="1.5"/>
      <rect x="2.25" y="2.25" width="15.5" height="15.5" rx="7.75" fill="${logoFill}"/>
      <text x="10" y="13" text-anchor="middle" font-family="Noto Sans, Open Sans, sans-serif" font-size="10" font-weight="800" fill="#ffffff">${
        mode === "s-bahn" ? "S" : "U"
      }</text>
      <text x="${21 + 4 + textWidth / 2}" y="13" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="9.2" font-weight="700" fill="#27414a">${safeLabel}</text>
    </svg>
  `;
}

function normalizeTransitData(data: TransitFeatureCollection) {
  const pointGroups = new Map<string, Array<TransitFeatureCollection["features"][number]>>();
  const lineGroups = new Map<string, Array<TransitFeatureCollection["features"][number]>>();

  data.features.forEach((feature) => {
    if (feature.geometry.type === "Point" && feature.properties.name) {
      const key = feature.properties.name;
      const group = pointGroups.get(key) ?? [];
      group.push(feature);
      pointGroups.set(key, group);
      return;
    }
    if (feature.geometry.type === "LineString" && feature.properties.ref) {
      const key = feature.properties.ref;
      const group = lineGroups.get(key) ?? [];
      group.push(feature);
      lineGroups.set(key, group);
    }
  });

  const normalizedLines = [...lineGroups.entries()].map(([ref, features], index) => {
    const bestFeature = features.reduce((best, current) => {
      const bestLength = transitLineLength((best.geometry as { coordinates: Array<[number, number]> }).coordinates);
      const currentLength = transitLineLength((current.geometry as { coordinates: Array<[number, number]> }).coordinates);
      return currentLength > bestLength ? current : best;
    });

    const colorCounts = new Map<string, number>();
    features.forEach((feature) => {
      if (feature.properties.color) {
        colorCounts.set(feature.properties.color, (colorCounts.get(feature.properties.color) ?? 0) + 1);
      }
    });
    const mostCommonColor =
      [...colorCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? bestFeature.properties.color;

    return {
      ...bestFeature,
      id: `line:${ref}:${index}`,
      properties: {
        ...bestFeature.properties,
        color: mostCommonColor,
        labelIcon: transitLineLabelIconId(bestFeature.properties.mode, ref),
        ref,
      },
    };
  });

  const normalizedPoints = [...pointGroups.entries()].map(([name, features], index) => {
    const coords = features.map((feature) => (feature.geometry as { coordinates: [number, number] }).coordinates);
    const count = coords.length || 1;
    const center = coords.reduce<[number, number]>(
      (acc, [lng, lat]) => [acc[0] + lng / count, acc[1] + lat / count],
      [0, 0],
    );
    const refs = [...new Set(features.flatMap((feature) => feature.properties.refs ?? []))].sort();
    const colors = [...new Set(features.flatMap((feature) => feature.properties.colors ?? []))];
    const modes = [...new Set(features.map((feature) => feature.properties.mode).filter(Boolean))] as Array<"s-bahn" | "u-bahn">;

    return {
      geometry: { coordinates: center, type: "Point" as const },
      id: `station:${index}`,
      properties: {
        colors,
        mode: modes.length === 1 ? modes[0] : (features[0]?.properties.mode ?? "u-bahn"),
        name,
        refs,
        stopId: transitStationKeyFromName(name),
      },
      type: "Feature" as const,
    };
  });

  return {
    ...data,
    features: [...normalizedLines, ...normalizedPoints],
  } satisfies TransitFeatureCollection;
}

function popupHtml(title: string, lines: string[], options?: { cancelled?: boolean }) {
  return `<div class="map-popup">${
    options?.cancelled ? '<span class="map-popup__status">Cancelled</span>' : ""
  }<strong class="${options?.cancelled ? "map-popup__title--cancelled" : ""}">${title}</strong>${lines
    .map((line) => `<span>${line}</span>`)
    .join("")}</div>`;
}

function svgDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function iconSvg(kind: "group" | "session" | "venue") {
  if (kind === "session") {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 32 32" fill="none" stroke="#fffaf4" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16 7.2c4.9 0 8.9 3.6 8.9 8.2 0 5.8-5.7 9.4-8.9 9.4s-8.9-3.6-8.9-9.4c0-4.6 4-8.2 8.9-8.2Z"/>
        <path d="M12.3 10.7c2.4 2.5 2.5 7.2.2 10"/>
        <path d="M19.7 10.7c-2.4 2.5-2.5 7.2-.2 10"/>
        <path d="M8.4 15.8h15.2"/>
      </svg>
    `;
  }
  if (kind === "venue") {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 32 32" fill="none" stroke="#fffaf4" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16 26.3c5.4-5.6 8.2-9.7 8.2-13.4a8.2 8.2 0 0 0-16.4 0c0 3.7 2.8 7.8 8.2 13.4Z"/>
        <path d="M16 9.6c2.3 0 4.1 1.5 4.1 3.5 0 2.8-2.8 4.4-4.1 4.4s-4.1-1.6-4.1-4.4c0-2 1.8-3.5 4.1-3.5Z"/>
        <path d="M13.4 12.7h5.2"/>
      </svg>
    `;
  }
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 32 32" fill="none" stroke="#fffaf4" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11.6 12.4c1.9 0 3.4-1.4 3.4-3.1s-1.5-3.1-3.4-3.1-3.4 1.4-3.4 3.1 1.5 3.1 3.4 3.1Z"/>
      <path d="M20.7 14.1c1.7 0 3-1.2 3-2.8s-1.3-2.8-3-2.8-3 1.2-3 2.8 1.3 2.8 3 2.8Z"/>
      <path d="M5.9 24.3c1.3-4.5 4.1-6.8 8.2-6.8 4 0 6.7 2.3 8.1 6.8"/>
      <path d="M17 24.3c1-2.6 3.1-4 6.1-4 1.3 0 2.4.2 3.3.7"/>
      <path d="M13.8 4.6c1.7.3 2.8 1 3.5 2.2"/>
    </svg>
  `;
}

function lockSvg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fffaf4" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
      <rect x="5" y="11" width="14" height="9" rx="2.5" fill="#1f2c2f" stroke="#fffaf4"/>
      <path d="M8 11V8.7a4 4 0 0 1 8 0V11"/>
    </svg>
  `;
}

function badgeIconId(theme: "dark" | "light", label: string, accent: string) {
  return `melon-badge-${theme}-${accent.replace(/[^a-z0-9]/gi, "")}-${label.replace(/[^a-z0-9]/gi, "").toLowerCase()}`;
}

function badgeAccent(theme: "dark" | "light", label: string) {
  const palette = currentThemePalette(theme);
  if (label === "Free") {
    return palette.badgeFreeText;
  }
  if (label === "Paid" || label.includes("€")) {
    return palette.badgePaidText;
  }
  return palette.badgeCountText;
}

function badgeSvg(theme: "dark" | "light", label: string, accent: string) {
  const width = Math.max(30, Math.round(label.length * 7.4 + 16));
  const pixelWidth = width * 2;
  const pixelHeight = 40;
  const palette = currentThemePalette(theme);
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${pixelWidth}" height="${pixelHeight}" viewBox="0 0 ${width} 20" fill="none">
      <rect x="0.75" y="0.75" width="${width - 1.5}" height="18.5" rx="9.25" fill="${palette.badgeFill}" stroke="${palette.badgeStroke}" stroke-width="1.5"/>
      <text x="${width / 2}" y="13.1" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="10" font-weight="600" fill="${accent}">${label}</text>
    </svg>
  `;
}

async function ensureMapIcon(map: maplibregl.Map, id: string, svg: string, pixelRatio = 2) {
  if (map.hasImage(id)) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (!map.hasImage(id)) {
        map.addImage(id, image, { pixelRatio });
      }
      resolve();
    };
    image.onerror = () => reject(new Error(`Failed to load image ${id}`));
    image.src = svgDataUrl(svg);
  });
}

async function ensureBaseAssets(map: maplibregl.Map) {
  await Promise.all([
    ensureMapIcon(map, "melon-icon-group", iconSvg("group")),
    ensureMapIcon(map, "melon-icon-lock", lockSvg()),
    ensureMapIcon(map, "melon-icon-session", iconSvg("session")),
    ensureMapIcon(map, "melon-icon-venue", iconSvg("venue")),
  ]);
}

function ensureMarkerSourceAndHitLayer(map: maplibregl.Map) {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      cluster: true,
      clusterMaxZoom: 12,
      clusterProperties: {
        groupCount: ["+", ["case", ["==", ["get", "kind"], "group"], 1, 0]],
        sessionCount: ["+", ["case", ["==", ["get", "kind"], "session"], 1, 0]],
      },
      clusterRadius: 58,
      data: { features: [], type: "FeatureCollection" },
      type: "geojson",
    });
  }

  if (!map.getLayer(LAYER_HIT_ID)) {
    map.addLayer({
      filter: ["!", ["has", "point_count"]],
      id: LAYER_HIT_ID,
      paint: {
        "circle-opacity": 0.01,
        "circle-radius": 24,
      },
      source: SOURCE_ID,
      type: "circle",
    });
  }

  if (!map.getSource(VENUE_SOURCE_ID)) {
    map.addSource(VENUE_SOURCE_ID, {
      cluster: true,
      clusterMaxZoom: 12,
      clusterRadius: 58,
      data: { features: [], type: "FeatureCollection" },
      type: "geojson",
    });
  }

  if (!map.getLayer(VENUE_HIT_LAYER_ID)) {
    map.addLayer({
      filter: ["!", ["has", "point_count"]],
      id: VENUE_HIT_LAYER_ID,
      paint: {
        "circle-opacity": 0.01,
        "circle-radius": 24,
      },
      source: VENUE_SOURCE_ID,
      type: "circle",
    });
  }
}

function moveAppMarkerLayersToTop(map: maplibregl.Map) {
  [
    TRANSIT_LINE_LAYER_ID,
    TRANSIT_LINE_HIGHLIGHT_LAYER_ID,
    TRANSIT_STATION_HALO_LAYER_ID,
    TRANSIT_STATION_DOT_LAYER_ID,
    TRANSIT_STATION_DOT_HIGHLIGHT_LAYER_ID,
    TRANSIT_STATION_LABEL_LAYER_ID,
    TRANSIT_STATION_LABEL_ROUTE_HIGHLIGHT_LAYER_ID,
    TRANSIT_STATION_LABEL_HIGHLIGHT_LAYER_ID,
    TRANSIT_LINE_LABEL_LAYER_ID,
    TRANSIT_LINE_LABEL_HIGHLIGHT_LAYER_ID,
    CLUSTER_LAYER_ID,
    CLUSTER_COUNT_LAYER_ID,
    VENUE_CLUSTER_LAYER_ID,
    VENUE_CLUSTER_COUNT_LAYER_ID,
    VENUE_BASE_LAYER_ID,
    VENUE_ICON_LAYER_ID,
    VENUE_BADGE_LAYER_ID,
    VENUE_LABEL_LAYER_ID,
    VENUE_HIT_LAYER_ID,
    LAYER_BASE_ID,
    LAYER_ICON_ID,
    LAYER_BADGE_ID,
    LAYER_CORNER_ID,
    LAYER_LABEL_ID,
    LAYER_HIT_ID,
  ].forEach((layerId) => {
    if (map.getLayer(layerId)) {
      map.moveLayer(layerId);
    }
  });
}

async function ensureBadgeAssets(map: maplibregl.Map, features: SimpleFeature[], theme: "dark" | "light") {
  const badges = new Map<string, { accent: string; label: string }>();
  for (const feature of features) {
    const { badge, badgeIcon } = feature.properties;
    if (!badge) {
      continue;
    }
    const accent = badgeAccent(theme, badge);
    badges.set(badgeIcon, { accent, label: badge });
  }
  await Promise.all(
    [...badges.entries()].map(([id, badge]) => ensureMapIcon(map, id, badgeSvg(theme, badge.label, badge.accent))),
  );
}

async function ensureTransitLineLabelAssets(map: maplibregl.Map, transitData: TransitFeatureCollection | null) {
  if (!transitData) {
    return;
  }
  const labelEntries = transitData.features
    .filter(
      (feature): feature is TransitFeatureCollection["features"][number] & { geometry: { coordinates: Array<[number, number]>; type: "LineString" } } =>
        feature.geometry.type === "LineString" &&
        typeof feature.properties.ref === "string" &&
        typeof feature.properties.labelIcon === "string",
    )
    .map((feature) => ({
      id: feature.properties.labelIcon as string,
      svg: transitLineLabelSvg(feature.properties.mode, feature.properties.ref as string),
    }));

  await Promise.all(labelEntries.map(({ id, svg }) => ensureMapIcon(map, id, svg)));
}

function formatPriceBadge(pricing: "free" | "paid", costPerPerson?: number | null) {
  if (pricing === "free") {
    return "Free";
  }
  if (typeof costPerPerson === "number" && Number.isFinite(costPerPerson)) {
    const rounded =
      Math.abs(costPerPerson - Math.round(costPerPerson)) < 0.01 ? String(Math.round(costPerPerson)) : costPerPerson.toFixed(1);
    return `${rounded.replace(/\.0$/, "")}€`;
  }
  return "Paid";
}

function formatSessionPopupLine(prefix: string, meeting: MeetingSummary | null | undefined) {
  if (!meeting) {
    return prefix;
  }
  return meeting.status === "cancelled" ? `${prefix} Cancelled — ${meeting.title}` : `${prefix} ${meeting.title}`;
}

function currentThemePalette(theme: "dark" | "light") {
  return theme === "dark"
    ? {
        badgeCountText: "#fff7f2",
        badgeFill: "#213430",
        badgeFreeText: "#7FCBC0",
        badgePaidText: "#F2A595",
        badgeStroke: "#5BB0A1",
        circleStroke: "#fff4df",
        clusterText: "#fffaf4",
        group: "#5BB0A1",
        groupOwner: "#7FCBC0",
        halo: "#0f1517",
        labelColor: "#fff7f2",
        selected: "#B22222",
        session: "#E58C80",
        venue: "#3F7A45",
        venuePaid: "#264B29",
        viewerAttending: "#D2B48C",
      }
    : {
        badgeCountText: "#231d1c",
        badgeFill: "#fffdfa",
        badgeFreeText: "#336137",
        badgePaidText: "#B22222",
        badgeStroke: "#e5d6d0",
        circleStroke: "#fff4df",
        clusterText: "#fffaf4",
        group: "#5BB0A1",
        groupOwner: "#7FCBC0",
        halo: "#fffdfa",
        labelColor: "#231d1c",
        selected: "#B22222",
        session: "#E58C80",
        venue: "#3F7A45",
        venuePaid: "#264B29",
        viewerAttending: "#D2B48C",
      };
}

function markerColorExpression(palette: ReturnType<typeof currentThemePalette>): maplibregl.ExpressionSpecification {
  return [
    "case",
    ["==", ["get", "selected"], 1],
    palette.selected,
    ["==", ["get", "attending"], 1],
    palette.viewerAttending,
    ["all", ["==", ["get", "kind"], "group"], ["==", ["get", "owner"], 1]],
    palette.groupOwner,
    ["all", ["==", ["get", "kind"], "venue"], ["==", ["get", "badge"], "Paid"]],
    palette.venuePaid,
    [
      "match",
      ["get", "kind"],
      "venue",
      palette.venue,
      "session",
      palette.session,
      palette.group,
    ],
  ];
}

function clusterColorExpression(palette: ReturnType<typeof currentThemePalette>): maplibregl.ExpressionSpecification {
  return [
    "case",
    [">", ["coalesce", ["get", "sessionCount"], 0], 0],
    palette.session,
    [">", ["coalesce", ["get", "groupCount"], 0], 0],
    palette.group,
    palette.venuePaid,
  ];
}

function mapStyle(theme: "dark" | "light"): string | maplibregl.StyleSpecification {
  if (theme === "dark") {
    return import.meta.env.VITE_MAP_STYLE_URL_DARK ?? DEFAULT_DARK_STYLE;
  }
  return import.meta.env.VITE_MAP_STYLE_URL ?? DEFAULT_LIGHT_STYLE;
}

function mapStyleKey(style: string | maplibregl.StyleSpecification) {
  return typeof style === "string" ? style : "melon-default-dark";
}

function buildFeatureCollection({
  groupPins,
  meetings,
  mode,
  selectedKey,
  theme,
  venueMeetingsById,
  venues,
}: {
  groupPins: GroupPin[];
  meetings: MeetingSummary[];
  mode: "groups" | "sessions" | "venues";
  selectedKey?: string | null;
  theme: "dark" | "light";
  venueMeetingsById: Record<string, MeetingSummary[]>;
  venues: VenueSummary[];
}) {
  const lookup = new Map<string, MarkerLookupEntry>();
  const features: SimpleFeature[] = [];

  if (mode === "venues") {
    for (const venue of venues) {
      const meetingsAtVenue = venueMeetingsById[venue.id] ?? [];
      const badge = venue.pricing === "free" ? "Free" : "Paid";
      const accent = badgeAccent(theme, badge);
      const lookupKey = `venue:${venue.id}`;
      lookup.set(lookupKey, {
        kind: "venue",
        popupLines: [
          venue.address,
          meetingsAtVenue[0] ? formatSessionPopupLine("Next:", meetingsAtVenue[0]) : "No sessions yet",
          meetingsAtVenue.length > 0 ? `${meetingsAtVenue.length} upcoming sessions` : venue.pricing,
        ],
        popupTitle: venue.name,
        venue,
      });
      features.push({
        geometry: { coordinates: [venue.longitude, venue.latitude], type: "Point" },
        properties: {
          attending: 0,
          badge,
          badgeIcon: badgeIconId(theme, badge, accent),
          cornerIcon: "",
          icon: "melon-icon-venue",
          kind: "venue",
          label: venue.name,
          lookupKey,
          owner: 0,
          private: 0,
          selected: selectedKey === lookupKey || selectedKey === venue.id ? 1 : 0,
        },
        type: "Feature",
      });
    }
    return {
      featureCollection: { features: [], type: "FeatureCollection" } as SimpleFeatureCollection,
      lookup,
      venueFeatureCollection: { features, type: "FeatureCollection" } as SimpleFeatureCollection,
    };
  }

  if (mode === "groups") {
    for (const pin of groupPins) {
      const badge = pin.filteredSessionCount > 0 ? `${pin.filteredSessionCount}x` : "";
      const accent = badgeAccent(theme, badge);
      const lookupKey = `group:${pin.group.id}`;
      lookup.set(lookupKey, {
        group: pin.group,
        kind: "group",
        popupLines: [
          pin.group.visibility,
          pin.nextMeeting ? formatSessionPopupLine("Next:", pin.nextMeeting) : "No session scheduled",
          `${pin.filteredSessionCount} matching sessions`,
        ],
        popupTitle: pin.group.name,
      });
      features.push({
        geometry: { coordinates: [pin.longitude, pin.latitude], type: "Point" },
        properties: {
          attending: 0,
          badge,
          badgeIcon: badgeIconId(theme, badge, accent),
          cornerIcon: pin.group.visibility === "private" ? "melon-icon-lock" : "",
          icon: "melon-icon-group",
          kind: "group",
          label: pin.group.name,
          lookupKey,
          owner: pin.group.viewerRole === "owner" ? 1 : 0,
          private: pin.group.visibility === "private" ? 1 : 0,
          selected: selectedKey === lookupKey || selectedKey === pin.group.id ? 1 : 0,
        },
        type: "Feature",
      });
    }
    return {
      featureCollection: { features, type: "FeatureCollection" } as SimpleFeatureCollection,
      lookup,
      venueFeatureCollection: { features: [], type: "FeatureCollection" } as SimpleFeatureCollection,
    };
  }

  const groupedSessions = new Map<string, MeetingSummary[]>();
  for (const meeting of meetings) {
    const locationKey = `${meeting.latitude.toFixed(5)}:${meeting.longitude.toFixed(5)}`;
    groupedSessions.set(locationKey, [...(groupedSessions.get(locationKey) ?? []), meeting]);
  }

  for (const sameLocation of groupedSessions.values()) {
    const sorted = [...sameLocation].sort(
      (left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
    );
    const representative = sorted[0];
    if (!representative) {
      continue;
    }
    const badge =
      sameLocation.length > 1
        ? `${sameLocation.length}x`
        : formatPriceBadge(representative.pricing, representative.costPerPerson);
    const accent = badgeAccent(theme, badge);
    const lookupKey =
      sameLocation.length > 1
        ? `session-cluster:${representative.latitude}:${representative.longitude}`
        : `session:${representative.id}`;
    lookup.set(
      lookupKey,
      sameLocation.length > 1
        ? {
            kind: "session-cluster",
            lookupKey,
            meetings: sorted,
            popupLines: [
              `${sameLocation.length} sessions at this location`,
              representative.status === "cancelled"
                ? `Next: Cancelled — ${representative.shortName || representative.title}`
                : `Next: ${representative.shortName || representative.title}`,
              representative.groupName,
            ],
            popupTitle: representative.locationName,
          }
        : {
            kind: "session",
            meeting: representative,
            popupLines: [
              representative.groupName,
              formatPriceBadge(representative.pricing, representative.costPerPerson),
              `${representative.claimedSpots}/${representative.capacity} spots claimed`,
              representative.locationName,
            ],
            popupTitle: representative.title,
          },
    );
    features.push({
      geometry: { coordinates: [representative.longitude, representative.latitude], type: "Point" },
      properties: {
        attending: sameLocation.some((item) => item.viewerHasClaimed) ? 1 : 0,
        badge,
        badgeIcon: badgeIconId(theme, badge, accent),
        cornerIcon: "",
        icon: "melon-icon-session",
        kind: "session",
        label: sameLocation.length > 1 ? representative.locationName : representative.shortName || representative.title,
        lookupKey,
        owner: 0,
        private: 0,
        selected: selectedKey === lookupKey || sameLocation.some((item) => item.id === selectedKey) ? 1 : 0,
      },
      type: "Feature",
    });
  }

  return {
    featureCollection: { features, type: "FeatureCollection" } as SimpleFeatureCollection,
    lookup,
    venueFeatureCollection: { features: [], type: "FeatureCollection" } as SimpleFeatureCollection,
  };
}

function selectedMarkerKeyForLookup(lookup: MarkerLookupEntry) {
  if (lookup.kind === "venue") {
    return lookup.venue.id;
  }
  if (lookup.kind === "group") {
    return lookup.group.id;
  }
  if (lookup.kind === "session") {
    return lookup.meeting.id;
  }
  return lookup.lookupKey;
}

function featureCollectionWithSelectedKey(
  featureCollection: SimpleFeatureCollection,
  selectedMarkerKey: SelectedMarkerKey,
): SimpleFeatureCollection {
  return {
    ...featureCollection,
    features: featureCollection.features.map((feature) => {
      const selected =
        selectedMarkerKey &&
        (feature.properties.lookupKey === selectedMarkerKey ||
          feature.properties.lookupKey.endsWith(`:${selectedMarkerKey}`))
          ? 1
          : 0;
      return {
        ...feature,
        properties: {
          ...feature.properties,
          selected,
        },
      };
    }),
  };
}

function applySelectedKeyToMapSources(map: maplibregl.Map, sourceData: ReturnType<typeof buildFeatureCollection>, selectedKey: SelectedMarkerKey) {
  const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  source?.setData(featureCollectionWithSelectedKey(sourceData.featureCollection, selectedKey) as never);
  const venueSource = map.getSource(VENUE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  venueSource?.setData(featureCollectionWithSelectedKey(sourceData.venueFeatureCollection, selectedKey) as never);
  map.triggerRepaint();
}

function updateLayerTheme(map: maplibregl.Map, theme: "dark" | "light") {
  const palette = currentThemePalette(theme);
  if (map.getLayer(LAYER_BASE_ID)) {
    map.setPaintProperty(LAYER_BASE_ID, "circle-color", markerColorExpression(palette));
    map.setPaintProperty(LAYER_BASE_ID, "circle-stroke-color", palette.circleStroke);
  }
  if (map.getLayer(CLUSTER_LAYER_ID)) {
    map.setPaintProperty(CLUSTER_LAYER_ID, "circle-color", clusterColorExpression(palette));
    map.setPaintProperty(CLUSTER_LAYER_ID, "circle-stroke-color", palette.circleStroke);
  }
  if (map.getLayer(CLUSTER_COUNT_LAYER_ID)) {
    map.setPaintProperty(CLUSTER_COUNT_LAYER_ID, "text-color", palette.clusterText);
    map.setPaintProperty(CLUSTER_COUNT_LAYER_ID, "text-halo-width", 0);
  }
  if (map.getLayer(VENUE_BASE_LAYER_ID)) {
    map.setPaintProperty(VENUE_BASE_LAYER_ID, "circle-color", markerColorExpression(palette));
    map.setPaintProperty(VENUE_BASE_LAYER_ID, "circle-stroke-color", palette.circleStroke);
  }
  if (map.getLayer(LAYER_LABEL_ID)) {
    map.setPaintProperty(LAYER_LABEL_ID, "text-color", palette.labelColor);
    map.setPaintProperty(LAYER_LABEL_ID, "text-halo-color", palette.halo);
  }
  if (map.getLayer(VENUE_LABEL_LAYER_ID)) {
    map.setPaintProperty(VENUE_LABEL_LAYER_ID, "text-color", palette.labelColor);
    map.setPaintProperty(VENUE_LABEL_LAYER_ID, "text-halo-color", palette.halo);
  }
  if (map.getLayer(VENUE_CLUSTER_LAYER_ID)) {
    map.setPaintProperty(VENUE_CLUSTER_LAYER_ID, "circle-color", palette.venuePaid);
    map.setPaintProperty(VENUE_CLUSTER_LAYER_ID, "circle-stroke-color", palette.circleStroke);
  }
  if (map.getLayer(VENUE_CLUSTER_COUNT_LAYER_ID)) {
    map.setPaintProperty(VENUE_CLUSTER_COUNT_LAYER_ID, "text-color", palette.clusterText);
    map.setPaintProperty(VENUE_CLUSTER_COUNT_LAYER_ID, "text-halo-width", 0);
  }
}

function applyTransitBoost(map: maplibregl.Map, theme: "dark" | "light") {
  const transitColor = theme === "dark" ? "#7baeba" : "#6f9aac";
  const transitHalo = theme === "dark" ? "#10181a" : "#fff7f0";
  const stationText = theme === "dark" ? "#abcdd5" : "#6d8790";
  const railLayerIds = [
    "road_transit_rail",
    "road_transit_rail_hatching",
    "bridge_transit_rail",
    "bridge_transit_rail_hatching",
    "tunnel_transit_rail",
    "tunnel_transit_rail_hatching",
  ];

  for (const layerId of railLayerIds) {
    if (!map.getLayer(layerId)) {
      continue;
    }
    map.setPaintProperty(layerId, "line-color", transitColor);
    map.setPaintProperty(layerId, "line-opacity", theme === "dark" ? 0.34 : 0.28);
    map.setPaintProperty(layerId, "line-width", [
      "interpolate",
      ["exponential", 1.35],
      ["zoom"],
      10,
      layerId.includes("hatching") ? 0 : 0.35,
      13,
      layerId.includes("hatching") ? 1.5 : 0.85,
      16,
      layerId.includes("hatching") ? 3.2 : 2.1,
      20,
      layerId.includes("hatching") ? 6.2 : 4.3,
    ]);
  }

  if (map.getLayer("poi_transit")) {
    map.setLayoutProperty("poi_transit", "icon-size", ["interpolate", ["linear"], ["zoom"], 10, 0.55, 14, 0.72, 17, 0.9]);
    map.setLayoutProperty("poi_transit", "text-size", ["interpolate", ["linear"], ["zoom"], 11, 9.5, 14, 11, 17, 12.2]);
    map.setPaintProperty("poi_transit", "text-color", stationText);
    map.setPaintProperty("poi_transit", "text-halo-color", transitHalo);
    map.setPaintProperty("poi_transit", "text-opacity", theme === "dark" ? 0.58 : 0.46);
    map.setPaintProperty("poi_transit", "icon-opacity", theme === "dark" ? 0.52 : 0.44);
    map.setPaintProperty("poi_transit", "text-halo-width", theme === "dark" ? 1.15 : 1.25);
  }
}

function addTransitOverlay(
  map: maplibregl.Map,
  theme: "dark" | "light",
  transitData: TransitFeatureCollection | null,
) {
  if (!transitData) {
    return;
  }

  const existingSource = map.getSource(TRANSIT_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  if (existingSource) {
    existingSource.setData(transitData);
    return;
  }

  map.addSource(TRANSIT_SOURCE_ID, {
    attribution: "VBB Verkehrsverbund Berlin-Brandenburg GmbH",
    data: transitData as never,
    type: "geojson",
  });

  map.addLayer({
    filter: ["==", ["geometry-type"], "LineString"],
    id: TRANSIT_LINE_LAYER_ID,
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": ["coalesce", ["get", "color"], theme === "dark" ? "#66d9ff" : "#087bb8"],
      "line-opacity": theme === "dark" ? 0.26 : 0.42,
      "line-width": ["interpolate", ["exponential", 1.35], ["zoom"], 8, 0.75, 11, 1.2, 14, 2.1, 17, 3.4],
    },
    source: TRANSIT_SOURCE_ID,
    type: "line",
  });

  map.addLayer({
    filter: ["==", ["get", "__never__"], "__never__"],
    id: TRANSIT_LINE_HIGHLIGHT_LAYER_ID,
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": ["coalesce", ["get", "color"], theme === "dark" ? "#b9eeff" : "#0b8fd1"],
      "line-opacity": theme === "dark" ? 0.96 : 0.92,
      "line-width": ["interpolate", ["exponential", 1.35], ["zoom"], 8, 1.8, 11, 2.8, 14, 4.3, 17, 6.4],
    },
    source: TRANSIT_SOURCE_ID,
    type: "line",
  });

  map.addLayer({
    filter: ["all", ["==", ["geometry-type"], "LineString"], ["has", "labelIcon"]],
    id: TRANSIT_LINE_LABEL_LAYER_ID,
    layout: {
      "icon-allow-overlap": false,
      "icon-image": ["get", "labelIcon"],
      "icon-keep-upright": true,
      "icon-optional": true,
      "icon-padding": 12,
      "icon-rotation-alignment": "viewport",
      "symbol-placement": "line-center",
      "symbol-spacing": 320,
    },
    minzoom: 10,
    paint: {
      "icon-opacity": ["interpolate", ["linear"], ["zoom"], 10, 0.24, 12, 0.38, 15, 0.5],
    },
    source: TRANSIT_SOURCE_ID,
    type: "symbol",
  });

  map.addLayer({
    filter: ["==", ["get", "__never__"], "__never__"],
    id: TRANSIT_LINE_LABEL_HIGHLIGHT_LAYER_ID,
    layout: {
      "icon-allow-overlap": false,
      "icon-image": ["get", "labelIcon"],
      "icon-keep-upright": true,
      "icon-optional": true,
      "icon-padding": 12,
      "icon-rotation-alignment": "viewport",
      "symbol-placement": "line-center",
      "symbol-spacing": 320,
    },
    minzoom: 10,
    paint: {
      "icon-opacity": 1,
      "icon-opacity-transition": { delay: 0, duration: 0 },
    },
    source: TRANSIT_SOURCE_ID,
    type: "symbol",
  });

  map.addLayer({
    filter: ["==", ["geometry-type"], "Point"],
    id: TRANSIT_STATION_HALO_LAYER_ID,
    paint: {
      "circle-color": theme === "dark" ? "#3c4b4d" : "#fff7ed",
      "circle-opacity": ["interpolate", ["linear"], ["zoom"], 8, 0, 9, theme === "dark" ? 0.5 : 0.58],
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 2.8, 11, 4, 15, 5.6],
    },
    source: TRANSIT_SOURCE_ID,
    type: "circle",
  });

  map.addLayer({
    filter: ["==", ["geometry-type"], "Point"],
    id: TRANSIT_STATION_DOT_LAYER_ID,
    paint: {
      "circle-color": [
        "case",
        ["==", ["get", "mode"], "s-bahn"],
        theme === "dark" ? "#4d6b59" : "#9ccfaf",
        theme === "dark" ? "#4b6570" : "#9fc7da",
      ],
      "circle-opacity": ["interpolate", ["linear"], ["zoom"], 8, 0.14, 9, theme === "dark" ? 0.5 : 0.62],
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 1.5, 11, 2.35, 15, 3.25],
      "circle-stroke-color": theme === "dark" ? "#3c4b4d" : "#fff7ed",
      "circle-stroke-width": 1.5,
    },
    source: TRANSIT_SOURCE_ID,
    type: "circle",
  });

  map.addLayer({
    filter: ["==", ["get", "__never__"], "__never__"],
    id: TRANSIT_STATION_DOT_HIGHLIGHT_LAYER_ID,
    paint: {
      "circle-color": [
        "case",
        ["==", ["get", "mode"], "s-bahn"],
        theme === "dark" ? "#bce3c8" : "#6fbb86",
        theme === "dark" ? "#b7deef" : "#5aa7cb",
      ],
      "circle-opacity": 1,
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 2.15, 11, 3.1, 15, 4.2],
      "circle-stroke-color": theme === "dark" ? "#d9f2f8" : "#fffdf8",
      "circle-stroke-width": 2,
    },
    source: TRANSIT_SOURCE_ID,
    type: "circle",
  });

  map.addLayer({
    filter: ["==", ["geometry-type"], "Point"],
    id: TRANSIT_STATION_LABEL_LAYER_ID,
    layout: {
      "text-field": ["get", "name"],
      "text-font": ["Noto Sans Regular", "Open Sans Regular"],
      "text-max-width": 9,
      "text-offset": [0, 0.9],
      "text-size": ["interpolate", ["linear"], ["zoom"], 9, 9.2, 12, 10.5, 15, 12],
      "text-optional": true,
    },
    paint: {
      "text-color": theme === "dark" ? "#7a9297" : "#4f727c",
      "text-halo-color": theme === "dark" ? "#10181a" : "#fff7f0",
      "text-halo-width": 1.25,
      "text-opacity": ["interpolate", ["linear"], ["zoom"], 9, 0, 10, theme === "dark" ? 0.38 : 0.6],
    },
    source: TRANSIT_SOURCE_ID,
    type: "symbol",
  });

  map.addLayer({
    filter: ["==", ["get", "__never__"], "__never__"],
    id: TRANSIT_STATION_LABEL_ROUTE_HIGHLIGHT_LAYER_ID,
    layout: {
      "text-field": ["get", "name"],
      "text-font": ["Noto Sans Regular", "Open Sans Regular"],
      "text-max-width": 9,
      "text-offset": [0, 0.9],
      "text-size": ["interpolate", ["linear"], ["zoom"], 9, 9.2, 12, 10.5, 15, 12],
      "text-optional": true,
    },
    paint: {
      "text-color": theme === "dark" ? "#9cb7bd" : "#3f6672",
      "text-halo-color": theme === "dark" ? "#10181a" : "#fff7f0",
      "text-halo-width": 1.35,
      "text-opacity": theme === "dark" ? 0.72 : 0.68,
      "text-color-transition": { delay: 0, duration: 0 },
      "text-opacity-transition": { delay: 0, duration: 0 },
    },
    source: TRANSIT_SOURCE_ID,
    type: "symbol",
  });

  map.addLayer({
    filter: ["==", ["get", "__never__"], "__never__"],
    id: TRANSIT_STATION_LABEL_HIGHLIGHT_LAYER_ID,
    layout: {
      "text-allow-overlap": true,
      "text-field": ["get", "name"],
      "text-font": ["Noto Sans Bold", "Open Sans Bold", "Noto Sans Regular"],
      "text-ignore-placement": true,
      "text-max-width": 9,
      "text-offset": [0, 0.9],
      "text-size": ["interpolate", ["linear"], ["zoom"], 9, 9.6, 12, 11.2, 15, 12.8],
      "text-optional": true,
    },
    paint: {
      "text-color": theme === "dark" ? "#d8edf2" : "#264d59",
      "text-halo-color": theme === "dark" ? "#10181a" : "#fff7f0",
      "text-halo-width": 1.55,
      "text-opacity": 1,
      "text-color-transition": { delay: 0, duration: 0 },
      "text-halo-color-transition": { delay: 0, duration: 0 },
      "text-halo-width-transition": { delay: 0, duration: 0 },
      "text-opacity-transition": { delay: 0, duration: 0 },
    },
    source: TRANSIT_SOURCE_ID,
    type: "symbol",
  });
}

function updateTransitOverlayTheme(map: maplibregl.Map, theme: "dark" | "light") {
  if (map.getLayer(TRANSIT_LINE_LAYER_ID)) {
    map.setPaintProperty(TRANSIT_LINE_LAYER_ID, "line-opacity", theme === "dark" ? 0.26 : 0.42);
  }
  if (map.getLayer(TRANSIT_LINE_HIGHLIGHT_LAYER_ID)) {
    map.setPaintProperty(TRANSIT_LINE_HIGHLIGHT_LAYER_ID, "line-color", [
      "coalesce",
      ["get", "color"],
      theme === "dark" ? "#b9eeff" : "#0b8fd1",
    ]);
    map.setPaintProperty(TRANSIT_LINE_HIGHLIGHT_LAYER_ID, "line-opacity", theme === "dark" ? 0.96 : 0.92);
  }
  if (map.getLayer(TRANSIT_LINE_LABEL_LAYER_ID)) {
    map.setPaintProperty(
      TRANSIT_LINE_LABEL_LAYER_ID,
      "icon-opacity",
      ["interpolate", ["linear"], ["zoom"], 10, 0.24, 12, 0.38, 15, 0.5],
    );
  }
  if (map.getLayer(TRANSIT_LINE_LABEL_HIGHLIGHT_LAYER_ID)) {
    map.setPaintProperty(
      TRANSIT_LINE_LABEL_HIGHLIGHT_LAYER_ID,
      "icon-opacity",
      1,
    );
  }
  if (map.getLayer(TRANSIT_STATION_LABEL_ROUTE_HIGHLIGHT_LAYER_ID)) {
    map.setPaintProperty(
      TRANSIT_STATION_LABEL_ROUTE_HIGHLIGHT_LAYER_ID,
      "text-color",
      theme === "dark" ? "#9cb7bd" : "#3f6672",
    );
    map.setPaintProperty(
      TRANSIT_STATION_LABEL_ROUTE_HIGHLIGHT_LAYER_ID,
      "text-halo-color",
      theme === "dark" ? "#10181a" : "#fff7f0",
    );
    map.setPaintProperty(
      TRANSIT_STATION_LABEL_ROUTE_HIGHLIGHT_LAYER_ID,
      "text-opacity",
      theme === "dark" ? 0.72 : 0.68,
    );
  }
  if (map.getLayer(TRANSIT_STATION_HALO_LAYER_ID)) {
    map.setPaintProperty(TRANSIT_STATION_HALO_LAYER_ID, "circle-color", theme === "dark" ? "#3c4b4d" : "#fff7ed");
    map.setPaintProperty(
      TRANSIT_STATION_HALO_LAYER_ID,
      "circle-opacity",
      ["interpolate", ["linear"], ["zoom"], 8, 0, 9, theme === "dark" ? 0.5 : 0.58],
    );
  }
  if (map.getLayer(TRANSIT_STATION_DOT_LAYER_ID)) {
    map.setPaintProperty(
      TRANSIT_STATION_DOT_LAYER_ID,
      "circle-color",
      [
        "case",
        ["==", ["get", "mode"], "s-bahn"],
        theme === "dark" ? "#4d6b59" : "#9ccfaf",
        theme === "dark" ? "#4b6570" : "#9fc7da",
      ],
    );
    map.setPaintProperty(
      TRANSIT_STATION_DOT_LAYER_ID,
      "circle-opacity",
      ["interpolate", ["linear"], ["zoom"], 8, 0.14, 9, theme === "dark" ? 0.5 : 0.62],
    );
    map.setPaintProperty(TRANSIT_STATION_DOT_LAYER_ID, "circle-stroke-color", theme === "dark" ? "#3c4b4d" : "#fff7ed");
  }
  if (map.getLayer(TRANSIT_STATION_DOT_HIGHLIGHT_LAYER_ID)) {
    map.setPaintProperty(
      TRANSIT_STATION_DOT_HIGHLIGHT_LAYER_ID,
      "circle-color",
      [
        "case",
        ["==", ["get", "mode"], "s-bahn"],
        theme === "dark" ? "#bce3c8" : "#6fbb86",
        theme === "dark" ? "#b7deef" : "#5aa7cb",
      ],
    );
    map.setPaintProperty(
      TRANSIT_STATION_DOT_HIGHLIGHT_LAYER_ID,
      "circle-stroke-color",
      theme === "dark" ? "#d9f2f8" : "#fffdf8",
    );
  }
  if (map.getLayer(TRANSIT_STATION_LABEL_LAYER_ID)) {
    map.setPaintProperty(TRANSIT_STATION_LABEL_LAYER_ID, "text-color", theme === "dark" ? "#7a9297" : "#4f727c");
    map.setPaintProperty(TRANSIT_STATION_LABEL_LAYER_ID, "text-halo-color", theme === "dark" ? "#10181a" : "#fff7f0");
    map.setPaintProperty(
      TRANSIT_STATION_LABEL_LAYER_ID,
      "text-opacity",
      ["interpolate", ["linear"], ["zoom"], 9, 0, 10, theme === "dark" ? 0.38 : 0.6],
    );
  }
  if (map.getLayer(TRANSIT_STATION_LABEL_HIGHLIGHT_LAYER_ID)) {
    map.setPaintProperty(
      TRANSIT_STATION_LABEL_HIGHLIGHT_LAYER_ID,
      "text-color",
      theme === "dark" ? "#d8edf2" : "#264d59",
    );
    map.setPaintProperty(
      TRANSIT_STATION_LABEL_HIGHLIGHT_LAYER_ID,
      "text-halo-color",
      theme === "dark" ? "#10181a" : "#fff7f0",
    );
  }
}

function interpolateTransitStationLabelSize(zoom: number) {
  if (zoom <= 9) {
    return 9.2;
  }
  if (zoom <= 12) {
    return 9.2 + ((zoom - 9) / 3) * (10.5 - 9.2);
  }
  if (zoom <= 15) {
    return 10.5 + ((zoom - 12) / 3) * (12 - 10.5);
  }
  return 12;
}

function findTransitStationLabelAtPoint(map: maplibregl.Map, point: maplibregl.Point) {
  const candidates = map.queryRenderedFeatures(
    [
      [point.x - 96, point.y - 18],
      [point.x + 96, point.y + 40],
    ],
    { layers: [TRANSIT_STATION_LABEL_LAYER_ID].filter((layerId) => map.getLayer(layerId)) },
  );

  const zoom = map.getZoom();
  const textSize = interpolateTransitStationLabelSize(zoom);
  const textHeight = textSize * 1.35;
  const labelTopOffset = textSize * 0.9;

  for (const feature of candidates) {
    const name = typeof feature.properties?.name === "string" ? feature.properties.name : "";
    const coordinates = (feature.geometry as { coordinates?: [number, number] }).coordinates;
    if (!name || !coordinates) {
      continue;
    }
    const anchor = map.project(coordinates);
    const estimatedWidth = Math.max(textSize * 2.6, name.length * textSize * 0.34);
    const left = anchor.x - estimatedWidth / 2 - 3;
    const right = anchor.x + estimatedWidth / 2 + 3;
    const top = anchor.y + labelTopOffset - 2;
    const bottom = top + textHeight + 4;
    if (point.x >= left && point.x <= right && point.y >= top && point.y <= bottom) {
      return feature;
    }
  }

  return null;
}

function collapseMapAttribution(map: maplibregl.Map) {
  const container = map.getContainer();
  container.querySelectorAll<HTMLElement>(".maplibregl-ctrl-attrib.maplibregl-compact-show").forEach((control) => {
    control.querySelector<HTMLButtonElement>(".maplibregl-ctrl-attrib-button")?.click();
    control.classList.remove("maplibregl-compact-show");
  });
  container
    .querySelectorAll<HTMLButtonElement>(".maplibregl-ctrl-attrib-button[aria-expanded='true']")
    .forEach((button) => {
      button.setAttribute("aria-expanded", "false");
    });
}

function readMapAttributionMarkup(map: maplibregl.Map) {
  const container = map.getContainer();
  const inner = container.querySelector<HTMLElement>(".maplibregl-ctrl-attrib-inner");
  return inner?.innerHTML?.trim() ?? "";
}

function attributionPlacementClassName(placement: MapAttributionPlacement) {
  return `map-attribution-control--${placement}`;
}

function transitLineRefsForFeature(
  feature:
    | maplibregl.MapGeoJSONFeature
    | TransitFeatureCollection["features"][number]
    | undefined,
) {
  if (!feature?.properties) {
    return [];
  }
  const { ref, refs } = feature.properties as { ref?: unknown; refs?: unknown };
  const values = Array.isArray(refs) ? refs : typeof ref === "string" && ref ? [ref] : [];
  return values.filter((value): value is TransitLineRef => typeof value === "string" && value.length > 0);
}

function transitStationKeyForFeature(feature: maplibregl.MapGeoJSONFeature | undefined) {
  if (!feature?.properties) {
    return null;
  }
  const { stopId, name } = feature.properties as { name?: unknown; stopId?: unknown };
  if (typeof name === "string" && name.length > 0) {
    return transitStationKeyFromName(name);
  }
  if (typeof stopId === "string" && stopId.length > 0) {
    return stopId as TransitStationKey;
  }
  return null;
}

function transitFeatureFilterForRefs(refs: TransitLineRef[]): maplibregl.FilterSpecification {
  if (!refs.length) {
    return ["==", ["get", "__never__"], "__never__"];
  }
  return [
    "any",
    ["in", ["get", "ref"], ["literal", refs]],
    ...refs.map((ref) => ["in", ref, ["coalesce", ["get", "refs"], ["literal", []]]]),
  ] as unknown as maplibregl.FilterSpecification;
}

function transitStationFilterForKey(stationKey: TransitStationKey | null): maplibregl.FilterSpecification {
  if (!stationKey) {
    return ["==", ["get", "__never__"], "__never__"];
  }
  return ["==", ["get", "stopId"], stationKey];
}

function transitStationKeyForTransitFeature(feature: TransitFeatureCollection["features"][number]) {
  const { stopId, name } = feature.properties;
  if (typeof stopId === "string" && stopId.length > 0) {
    return stopId as TransitStationKey;
  }
  if (typeof name === "string" && name.length > 0) {
    return `name:${name}` as TransitStationKey;
  }
  return null;
}

function transitRefsForStationKey(
  transitData: TransitFeatureCollection | null,
  stationKey: TransitStationKey | null,
) {
  if (!transitData || !stationKey) {
    return [];
  }
  const stationFeature = transitData.features.find(
    (feature) =>
      feature.geometry.type === "Point" &&
      transitStationKeyForTransitFeature(feature) === stationKey,
  );
  return transitLineRefsForFeature(stationFeature);
}

function transitRefsForPillFeature(feature: maplibregl.MapGeoJSONFeature | undefined) {
  const refs = transitLineRefsForFeature(feature);
  return refs.length ? refs : [];
}

function stationHasMultipleLines(
  transitData: TransitFeatureCollection | null,
  stationKey: TransitStationKey | null,
) {
  return transitRefsForStationKey(transitData, stationKey).length > 1;
}

function updateTransitHighlightLayers(
  map: maplibregl.Map,
  selectedRefs: TransitLineRef[],
  highlightedStationKey: TransitStationKey | null,
  hoveredPillRefs: TransitLineRef[],
) {
  const selectedLineFilter = transitFeatureFilterForRefs(selectedRefs);
  const hoveredPillFilter = transitFeatureFilterForRefs(hoveredPillRefs);
  if (map.getLayer(TRANSIT_LINE_HIGHLIGHT_LAYER_ID)) {
    map.setFilter(TRANSIT_LINE_HIGHLIGHT_LAYER_ID, selectedLineFilter);
  }
  if (map.getLayer(TRANSIT_LINE_LABEL_HIGHLIGHT_LAYER_ID)) {
    map.setFilter(
      TRANSIT_LINE_LABEL_HIGHLIGHT_LAYER_ID,
      selectedRefs.length ? selectedLineFilter : hoveredPillFilter,
    );
  }
  if (map.getLayer(TRANSIT_STATION_LABEL_ROUTE_HIGHLIGHT_LAYER_ID)) {
    map.setFilter(TRANSIT_STATION_LABEL_ROUTE_HIGHLIGHT_LAYER_ID, selectedLineFilter);
  }
  if (map.getLayer(TRANSIT_STATION_DOT_HIGHLIGHT_LAYER_ID)) {
    map.setFilter(TRANSIT_STATION_DOT_HIGHLIGHT_LAYER_ID, transitStationFilterForKey(highlightedStationKey));
  }
  if (map.getLayer(TRANSIT_STATION_LABEL_HIGHLIGHT_LAYER_ID)) {
    map.setFilter(TRANSIT_STATION_LABEL_HIGHLIGHT_LAYER_ID, transitStationFilterForKey(highlightedStationKey));
  }
}

function setTransitVisibility(map: maplibregl.Map, visible: boolean) {
  TRANSIT_LAYER_IDS.forEach((layerId) => {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
    }
  });
}

function addLayers(map: maplibregl.Map, theme: "dark" | "light", transitData: TransitFeatureCollection | null) {
  const palette = currentThemePalette(theme);
  applyTransitBoost(map, theme);
  addTransitOverlay(map, theme, transitData);
  updateTransitOverlayTheme(map, theme);
  ensureMarkerSourceAndHitLayer(map);

  if (!map.getLayer(CLUSTER_LAYER_ID)) {
    map.addLayer({
      filter: ["has", "point_count"],
      id: CLUSTER_LAYER_ID,
      paint: {
        "circle-color": clusterColorExpression(palette),
        "circle-radius": [
          "step",
          ["get", "point_count"],
          20,
          8,
          25,
          18,
          31,
        ],
        "circle-stroke-color": palette.circleStroke,
        "circle-stroke-opacity": 0.92,
        "circle-stroke-width": 3,
      },
      source: SOURCE_ID,
      type: "circle",
    });
  }

  if (!map.getLayer(CLUSTER_COUNT_LAYER_ID)) {
    map.addLayer({
      filter: ["has", "point_count"],
      id: CLUSTER_COUNT_LAYER_ID,
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-font": ["Noto Sans Bold", "Open Sans Bold", "Noto Sans Regular"],
        "text-size": 14,
      },
      paint: {
        "text-color": palette.clusterText,
        "text-halo-width": 0,
      },
      source: SOURCE_ID,
      type: "symbol",
    });
  }

  if (!map.getLayer(VENUE_CLUSTER_LAYER_ID)) {
    map.addLayer({
      filter: ["has", "point_count"],
      id: VENUE_CLUSTER_LAYER_ID,
      paint: {
        "circle-color": palette.venuePaid,
        "circle-radius": [
          "step",
          ["get", "point_count"],
          20,
          8,
          25,
          18,
          31,
        ],
        "circle-stroke-color": palette.circleStroke,
        "circle-stroke-opacity": 0.92,
        "circle-stroke-width": 3,
      },
      source: VENUE_SOURCE_ID,
      type: "circle",
    });
  }

  if (!map.getLayer(VENUE_CLUSTER_COUNT_LAYER_ID)) {
    map.addLayer({
      filter: ["has", "point_count"],
      id: VENUE_CLUSTER_COUNT_LAYER_ID,
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-font": ["Noto Sans Bold", "Open Sans Bold", "Noto Sans Regular"],
        "text-size": 14,
      },
      paint: {
        "text-color": palette.clusterText,
        "text-halo-width": 0,
      },
      source: VENUE_SOURCE_ID,
      type: "symbol",
    });
  }

  if (!map.getLayer(LAYER_BASE_ID)) {
    map.addLayer({
      filter: ["!", ["has", "point_count"]],
      id: LAYER_BASE_ID,
      paint: {
        "circle-color": markerColorExpression(palette),
        "circle-radius": [
          "case",
          ["==", ["get", "selected"], 1],
          22,
          ["==", ["get", "kind"], "venue"],
          18.5,
          ["==", ["get", "kind"], "group"],
          17.5,
          17,
        ],
        "circle-stroke-color": palette.circleStroke,
        "circle-stroke-opacity": 0.92,
        "circle-stroke-width": ["case", ["==", ["get", "selected"], 1], 4.5, 3],
      },
      source: SOURCE_ID,
      type: "circle",
    });
  }

  if (!map.getLayer(VENUE_BASE_LAYER_ID)) {
    map.addLayer({
      filter: ["!", ["has", "point_count"]],
      id: VENUE_BASE_LAYER_ID,
      paint: {
        "circle-color": markerColorExpression(palette),
        "circle-radius": ["case", ["==", ["get", "selected"], 1], 22, 18.5],
        "circle-stroke-color": palette.circleStroke,
        "circle-stroke-opacity": 0.92,
        "circle-stroke-width": ["case", ["==", ["get", "selected"], 1], 4.5, 3],
      },
      source: VENUE_SOURCE_ID,
      type: "circle",
    });
  }

  if (!map.getLayer(LAYER_ICON_ID)) {
    map.addLayer({
      filter: ["!", ["has", "point_count"]],
      id: LAYER_ICON_ID,
      layout: {
        "icon-allow-overlap": true,
        "icon-anchor": "center",
        "icon-image": ["get", "icon"],
        "icon-size": 0.82,
      },
      source: SOURCE_ID,
      type: "symbol",
    });
  }

  if (!map.getLayer(VENUE_ICON_LAYER_ID)) {
    map.addLayer({
      filter: ["!", ["has", "point_count"]],
      id: VENUE_ICON_LAYER_ID,
      layout: {
        "icon-allow-overlap": true,
        "icon-anchor": "center",
        "icon-image": ["get", "icon"],
        "icon-size": 0.82,
      },
      source: VENUE_SOURCE_ID,
      type: "symbol",
    });
  }

  if (!map.getLayer(LAYER_BADGE_ID)) {
    map.addLayer({
      filter: ["all", ["!", ["has", "point_count"]], ["!=", ["get", "badge"], ""]],
      id: LAYER_BADGE_ID,
      layout: {
        "icon-allow-overlap": true,
        "icon-anchor": "bottom-left",
        "icon-image": ["get", "badgeIcon"],
        "icon-offset": [7.2, -7.1],
        "icon-size": 0.92,
      },
      source: SOURCE_ID,
      type: "symbol",
    });
  }

  if (!map.getLayer(VENUE_BADGE_LAYER_ID)) {
    map.addLayer({
      filter: ["all", ["!", ["has", "point_count"]], ["!=", ["get", "badge"], ""]],
      id: VENUE_BADGE_LAYER_ID,
      layout: {
        "icon-allow-overlap": true,
        "icon-anchor": "bottom-left",
        "icon-image": ["get", "badgeIcon"],
        "icon-offset": [7.2, -7.1],
        "icon-size": 0.92,
      },
      source: VENUE_SOURCE_ID,
      type: "symbol",
    });
  }

  if (!map.getLayer(LAYER_CORNER_ID)) {
    map.addLayer({
      filter: ["all", ["!", ["has", "point_count"]], ["!=", ["get", "cornerIcon"], ""]],
      id: LAYER_CORNER_ID,
      layout: {
        "icon-allow-overlap": true,
        "icon-anchor": "top-left",
        "icon-image": ["get", "cornerIcon"],
        "icon-offset": [6.8, 6.8],
        "icon-size": 0.52,
      },
      source: SOURCE_ID,
      type: "symbol",
    });
  }

  if (!map.getLayer(LAYER_LABEL_ID)) {
    map.addLayer({
      filter: ["!", ["has", "point_count"]],
      id: LAYER_LABEL_ID,
      layout: {
        "text-allow-overlap": true,
        "text-anchor": "top",
        "text-field": ["get", "label"],
        "text-font": ["Noto Sans Regular", "Open Sans Regular"],
        "text-max-width": 10,
        "text-offset": [0, 2.45],
        "text-size": 13,
      },
      paint: {
        "text-color": palette.labelColor,
        "text-halo-color": palette.halo,
        "text-halo-width": 2.5,
      },
      source: SOURCE_ID,
      type: "symbol",
    });
  }

  if (!map.getLayer(VENUE_LABEL_LAYER_ID)) {
    map.addLayer({
      filter: ["!", ["has", "point_count"]],
      id: VENUE_LABEL_LAYER_ID,
      layout: {
        "text-allow-overlap": true,
        "text-anchor": "top",
        "text-field": ["get", "label"],
        "text-font": ["Noto Sans Regular", "Open Sans Regular"],
        "text-max-width": 10,
        "text-offset": [0, 2.45],
        "text-size": ["interpolate", ["linear"], ["zoom"], 12, 0, 12.5, 12, 14, 13],
      },
      paint: {
        "text-color": palette.labelColor,
        "text-halo-color": palette.halo,
        "text-halo-width": 2.5,
        "text-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0, 12.5, 1],
      },
      source: VENUE_SOURCE_ID,
      type: "symbol",
    });
  }

  updateLayerTheme(map, theme);
  moveAppMarkerLayersToTop(map);
}

export function MapView({
  groupPins = [],
  meetings,
  mode,
  onBackgroundClick,
  onBoundsChange,
  onGroupSelect,
  onMeetingClusterSelect,
  onMeetingSelect,
  onVenueSelect,
  selectionRevision = 0,
  selectedKey,
  selectedLocation,
  theme,
  venueMeetingsById = {},
  venues,
  visible = true,
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRootRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const lookupRef = useRef<Map<string, MarkerLookupEntry>>(new Map());
  const interactionsBoundRef = useRef(false);
  const appliedStyleRef = useRef<string | null>(null);
  const optimisticSelectedKeyRef = useRef<SelectedMarkerKey>(null);
  const centeredSelectionRef = useRef<string | null>(null);
  const suppressBackgroundClickRef = useRef(false);
  const hoveredTransitStationKeyRef = useRef<TransitStationKey | null>(null);
  const hoveredTransitPillRefsRef = useRef<TransitLineRef[]>([]);
  const selectedTransitStationKeyRef = useRef<TransitStationKey | null>(null);
  const selectedTransitRefsRef = useRef<TransitLineRef[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [transitData, setTransitData] = useState<TransitFeatureCollection | null>(null);
  const [showTransit, setShowTransit] = useState(true);
  const [attributionOpen, setAttributionOpen] = useState(false);
  const [attributionMarkup, setAttributionMarkup] = useState("");

  const emitBoundsChange = useEffectEvent(onBoundsChange);
  const emitBackgroundClick = useEffectEvent(onBackgroundClick ?? (() => undefined));
  const emitGroupSelect = useEffectEvent(onGroupSelect ?? (() => undefined));
  const emitMeetingClusterSelect = useEffectEvent(onMeetingClusterSelect ?? (() => undefined));
  const emitMeetingSelect = useEffectEvent(onMeetingSelect);
  const emitVenueSelect = useEffectEvent(onVenueSelect);

  const sourceData = useMemo(
    () =>
      buildFeatureCollection({
        groupPins,
        meetings,
        mode,
        selectedKey,
        theme,
        venueMeetingsById,
        venues,
      }),
    [groupPins, meetings, mode, selectedKey, theme, venueMeetingsById, venues],
  );
  const currentStyle = mapStyle(theme);
  const currentStyleKey = mapStyleKey(currentStyle);
  const sourceDataRef = useRef(sourceData);
  const themeRef = useRef(theme);
  const transitDataRef = useRef<TransitFeatureCollection | null>(null);
  sourceDataRef.current = sourceData;
  themeRef.current = theme;
  transitDataRef.current = transitData;

  useEffect(() => {
    let active = true;
    fetch(TRANSIT_OVERLAY_URL)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: unknown) => {
        if (
          active &&
          data &&
          typeof data === "object" &&
          "type" in data &&
          data.type === "FeatureCollection"
        ) {
          setTransitData(normalizeTransitData(data as TransitFeatureCollection));
        }
      })
      .catch(() => {
        if (active) {
          setTransitData(null);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      attributionControl: { compact: true },
      center: BERLIN_CENTER,
      container: mapContainerRef.current,
      style: currentStyle,
      zoom: 10.8,
    });
    appliedStyleRef.current = currentStyleKey;

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    const syncBounds = () => {
      const bounds = map.getBounds();
      emitBoundsChange({
        east: bounds.getEast(),
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        west: bounds.getWest(),
      });
    };

    const applyOptimisticSelection = (nextSelectedKey: SelectedMarkerKey) => {
      optimisticSelectedKeyRef.current = nextSelectedKey;
      applySelectedKeyToMapSources(map, sourceDataRef.current, nextSelectedKey);
    };

    const syncTransitHighlight = () => {
      updateTransitHighlightLayers(
        map,
        selectedTransitRefsRef.current,
        selectedTransitStationKeyRef.current ?? hoveredTransitStationKeyRef.current,
        hoveredTransitPillRefsRef.current,
      );
    };

    const setHoveredTransitStationKey = (stationKey: TransitStationKey | null) => {
      hoveredTransitStationKeyRef.current = stationKey;
      syncTransitHighlight();
    };

    const setHoveredTransitPillRefs = (refs: TransitLineRef[]) => {
      hoveredTransitPillRefsRef.current = refs;
      syncTransitHighlight();
    };

    const setSelectedTransitSelection = (stationKey: TransitStationKey | null, refs: TransitLineRef[]) => {
      selectedTransitStationKeyRef.current = stationKey;
      selectedTransitRefsRef.current = refs;
      syncTransitHighlight();
    };

    const markerInteractiveLayerIds = [VENUE_HIT_LAYER_ID, LAYER_HIT_ID];

    const expandClusterAtPoint = async (event: maplibregl.MapMouseEvent, layerId: string, sourceId: string) => {
      if (!map.getLayer(layerId)) {
        return false;
      }
      const clusterFeature = map.queryRenderedFeatures(event.point, { layers: [layerId] })[0];
      const clusterId = Number(clusterFeature?.properties?.cluster_id);
      if (!Number.isFinite(clusterId)) {
        return false;
      }
      const source = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
      const coordinates = (clusterFeature.geometry as unknown as { coordinates?: [number, number] }).coordinates;
      if (!source || !coordinates) {
        return false;
      }
      const zoom = await source.getClusterExpansionZoom(clusterId);
      map.easeTo({
        center: coordinates,
        duration: 450,
        essential: true,
        zoom,
      });
      return true;
    };

    const handleMapClick = async (event: maplibregl.MapMouseEvent) => {
      if (
        (await expandClusterAtPoint(event, CLUSTER_LAYER_ID, SOURCE_ID)) ||
        (await expandClusterAtPoint(event, VENUE_CLUSTER_LAYER_ID, VENUE_SOURCE_ID))
      ) {
        return;
      }

      const features = map.queryRenderedFeatures(event.point, {
        layers: markerInteractiveLayerIds.filter((layerId) => map.getLayer(layerId)),
      });
      const feature = features.find((item) => item.properties?.lookupKey);
      const lookupKey = feature?.properties?.lookupKey;

      if (lookupKey) {
        setSelectedTransitSelection(null, []);
        setHoveredTransitPillRefs([]);
        const lookup = lookupRef.current.get(String(lookupKey));
        if (!lookup) {
          return;
        }
        applyOptimisticSelection(selectedMarkerKeyForLookup(lookup));
        if (lookup.kind === "session-cluster") {
          emitMeetingClusterSelect({
            lookupKey: lookup.lookupKey,
            meetings: lookup.meetings,
            title: lookup.popupTitle,
          });
        } else if (lookup.kind === "session") {
          emitMeetingSelect(lookup.meeting);
        } else if (lookup.kind === "venue") {
          emitVenueSelect(lookup.venue);
        } else {
          emitGroupSelect(lookup.group);
        }
        return;
      }

      const hoveredTransitStation = findTransitStationLabelAtPoint(map, event.point);
      const transitStationKey = transitStationKeyForFeature(hoveredTransitStation ?? undefined);
      const transitRefs = transitRefsForStationKey(transitDataRef.current, transitStationKey);
      if (transitRefs.length) {
        setHoveredTransitPillRefs([]);
        setSelectedTransitSelection(
          transitStationKey,
          stationHasMultipleLines(transitDataRef.current, transitStationKey) ? transitRefs : transitRefs.slice(0, 1),
        );
        return;
      }

      const pillFeature = map.queryRenderedFeatures(event.point, {
        layers: [TRANSIT_LINE_LABEL_HIGHLIGHT_LAYER_ID, TRANSIT_LINE_LABEL_LAYER_ID].filter((layerId) => map.getLayer(layerId)),
      })[0];
      const pillRefs = transitRefsForPillFeature(pillFeature);
      if (pillRefs.length) {
        setHoveredTransitPillRefs([]);
        setSelectedTransitSelection(null, pillRefs.slice(0, 1));
        return;
      }

      if (suppressBackgroundClickRef.current) {
        suppressBackgroundClickRef.current = false;
        return;
      }
      setHoveredTransitPillRefs([]);
      setSelectedTransitSelection(null, []);
      applyOptimisticSelection(null);
      emitBackgroundClick();
    };

    const handleHover = (event: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      map.getCanvas().style.cursor = "pointer";
      const feature = event.features?.[0];
      const lookupKey = feature?.properties?.lookupKey;
      if (!lookupKey) {
        return;
      }
      const lookup = lookupRef.current.get(String(lookupKey));
      if (!lookup) {
        return;
      }
      const geometry = feature?.geometry as unknown as { coordinates?: [number, number] };
      const coordinates = geometry.coordinates;
      if (!coordinates) {
        return;
      }
      popupRef.current
        ?.setLngLat(coordinates)
        .setHTML(
          popupHtml(lookup.popupTitle, lookup.popupLines, {
            cancelled: lookup.kind === "session" && lookup.meeting.status === "cancelled",
          }),
        )
        .addTo(map);
    };

    const clearHover = () => {
      map.getCanvas().style.cursor = "";
      popupRef.current?.remove();
    };

    const handleTransitHover = (event: maplibregl.MapMouseEvent) => {
      const pillFeature = map.queryRenderedFeatures(event.point, {
        layers: [TRANSIT_LINE_LABEL_HIGHLIGHT_LAYER_ID, TRANSIT_LINE_LABEL_LAYER_ID].filter((layerId) => map.getLayer(layerId)),
      })[0];
      const pillRefs = transitRefsForPillFeature(pillFeature);
      if (pillRefs.length) {
        map.getCanvas().style.cursor = "pointer";
        setHoveredTransitStationKey(null);
        setHoveredTransitPillRefs(pillRefs.slice(0, 1));
        return;
      }

      const hoveredTransitStation = findTransitStationLabelAtPoint(map, event.point);
      map.getCanvas().style.cursor = hoveredTransitStation ? "pointer" : "";
      setHoveredTransitPillRefs([]);
      setHoveredTransitStationKey(transitStationKeyForFeature(hoveredTransitStation ?? undefined));
    };

    const clearTransitHover = () => {
      map.getCanvas().style.cursor = "";
      setHoveredTransitPillRefs([]);
      setHoveredTransitStationKey(null);
    };

    const handleLoad = async () => {
      ensureMarkerSourceAndHitLayer(map);
      lookupRef.current = sourceDataRef.current.lookup;
      applySelectedKeyToMapSources(map, sourceDataRef.current, optimisticSelectedKeyRef.current);
      await ensureBaseAssets(map);
      await ensureBadgeAssets(
        map,
        [...sourceDataRef.current.featureCollection.features, ...sourceDataRef.current.venueFeatureCollection.features],
        themeRef.current,
      );
      await ensureTransitLineLabelAssets(map, transitDataRef.current);
      addLayers(map, themeRef.current, transitDataRef.current);
      setTransitVisibility(map, showTransit);
      syncTransitHighlight();
      setAttributionMarkup(readMapAttributionMarkup(map));
      applySelectedKeyToMapSources(map, sourceDataRef.current, optimisticSelectedKeyRef.current);
      moveAppMarkerLayersToTop(map);
      map.triggerRepaint();
      popupRef.current ??= new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 18 });
      if (!interactionsBoundRef.current) {
        map.on("click", handleMapClick);
        [CLUSTER_LAYER_ID, VENUE_CLUSTER_LAYER_ID, ...markerInteractiveLayerIds].forEach((layerId) => {
          map.on("mousemove", layerId, handleHover);
          map.on("mouseleave", layerId, clearHover);
        });
        map.on("mousemove", handleTransitHover);
        map.on("mouseout", clearTransitHover);
        map.on("movestart", clearHover);
        map.on("moveend", syncBounds);
        interactionsBoundRef.current = true;
      }
      syncBounds();
      setMapReady(true);
    };

    map.on("load", () => {
      void handleLoad();
    });

    const syncAttributionMarkup = () => {
      setAttributionMarkup(readMapAttributionMarkup(map));
    };

    const attributionNode = map.getContainer().querySelector(".maplibregl-ctrl-attrib");
    const attributionObserver =
      attributionNode instanceof HTMLElement
        ? new MutationObserver(() => {
            syncAttributionMarkup();
          })
        : null;
    if (attributionObserver && attributionNode instanceof HTMLElement) {
      attributionObserver.observe(attributionNode, {
        attributes: true,
        childList: true,
        subtree: true,
      });
    }

    mapRef.current = map;

    return () => {
      attributionObserver?.disconnect();
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
      interactionsBoundRef.current = false;
      setMapReady(false);
      setAttributionMarkup("");
    };
  }, [currentStyle, currentStyleKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (visible) {
      map?.resize();
    }
    if (!selectedLocation) {
      centeredSelectionRef.current = null;
    }
    if (!map || !mapReady || !selectedLocation || !visible) {
      return;
    }
    if (centeredSelectionRef.current === selectedLocation.id) {
      return;
    }

    centeredSelectionRef.current = selectedLocation.id;
    const refreshSelection = () => {
      if (selectedKey) {
        optimisticSelectedKeyRef.current = selectedKey;
        applySelectedKeyToMapSources(map, sourceDataRef.current, selectedKey);
      }
    };
    map.once("moveend", refreshSelection);
    map.easeTo({
      center: [selectedLocation.longitude, selectedLocation.latitude],
      duration: 650,
      essential: true,
      zoom: Math.max(map.getZoom(), SELECTED_MARKER_ZOOM),
    });
    return () => {
      map.off("moveend", refreshSelection);
    };
  }, [mapReady, selectedKey, selectedLocation, visible]);

  useLayoutEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    collapseMapAttribution(map);
  }, [attributionMarkup, selectedKey]);

  useEffect(() => {
    if (!attributionOpen) {
      return;
    }

    function handleDocumentPointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && mapRootRef.current?.contains(target)) {
        return;
      }
      setAttributionOpen(false);
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown);
    return () => document.removeEventListener("pointerdown", handleDocumentPointerDown);
  }, [attributionOpen]);

  useEffect(() => {
    if (!visible) {
      setAttributionOpen(false);
    }
  }, [visible]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.isStyleLoaded()) {
      return;
    }
    setTransitVisibility(map, showTransit);
  }, [mapReady, showTransit]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || appliedStyleRef.current === currentStyleKey) {
      return;
    }
    appliedStyleRef.current = currentStyleKey;
    popupRef.current?.remove();
    setMapReady(false);
    map.setStyle(currentStyle);
    map.once("style.load", () => {
      setMapReady(true);
    });
  }, [currentStyle, currentStyleKey]);

  useLayoutEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.isStyleLoaded()) {
      return;
    }

    let active = true;
    lookupRef.current = sourceData.lookup;
    const selectedMarkerKey = selectedKey ?? null;
    optimisticSelectedKeyRef.current = selectedMarkerKey;
    if (!selectedMarkerKey) {
      popupRef.current?.remove();
      map.getCanvas().style.cursor = "";
    }
    applySelectedKeyToMapSources(map, sourceData, selectedMarkerKey);

    void (async () => {
      await ensureBaseAssets(map);
      await ensureBadgeAssets(
        map,
        [...sourceData.featureCollection.features, ...sourceData.venueFeatureCollection.features],
        theme,
      );
      await ensureTransitLineLabelAssets(map, transitData);
      if (!active) {
        return;
      }
      ensureMarkerSourceAndHitLayer(map);
      addLayers(map, theme, transitData);
      updateLayerTheme(map, theme);
      setTransitVisibility(map, showTransit);
      updateTransitHighlightLayers(
        map,
        selectedTransitRefsRef.current,
        selectedTransitStationKeyRef.current ?? hoveredTransitStationKeyRef.current,
        hoveredTransitPillRefsRef.current,
      );
      applySelectedKeyToMapSources(map, sourceData, optimisticSelectedKeyRef.current);
      moveAppMarkerLayersToTop(map);
      map.triggerRepaint();
    })();

    return () => {
      active = false;
    };
  }, [mapReady, selectionRevision, selectedKey, sourceData, theme, transitData]);

  return (
    <div className="map-stage-shell" ref={mapRootRef}>
      <div className="map-stage" ref={mapContainerRef} />
      <div className="map-transit-toggle">
        <button
          aria-pressed={showTransit}
          className={`map-transit-toggle__button ${showTransit ? "is-active" : ""}`.trim()}
          onClick={() => setShowTransit((current) => !current)}
          type="button"
        >
          <TrainFront size={16} strokeWidth={2} />
          <span>Transit</span>
        </button>
      </div>
      {attributionMarkup ? (
        <div
          className={`map-attribution-control ${attributionPlacementClassName(MAP_ATTRIBUTION_PLACEMENT)} ${
            attributionOpen ? "is-open" : ""
          }`.trim()}
        >
          <button
            aria-controls="map-attribution-panel"
            aria-expanded={attributionOpen}
            aria-label={attributionOpen ? "Hide map attribution" : "Show map attribution"}
            className="map-attribution-control__button"
            onClick={() => setAttributionOpen((open) => !open)}
            type="button"
          >
            <Info size={16} strokeWidth={2.1} />
          </button>
          <div
            className="map-attribution-control__panel"
            id="map-attribution-panel"
            dangerouslySetInnerHTML={{ __html: attributionMarkup }}
          />
        </div>
      ) : null}
    </div>
  );
}
