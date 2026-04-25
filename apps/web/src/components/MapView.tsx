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
    properties: {
      color?: string;
      colors?: string[];
      mode?: "s-bahn" | "u-bahn";
      name?: string;
      ref?: string;
      refs?: string[];
    };
    type: "Feature";
  }>;
  type: "FeatureCollection";
};

const BERLIN_CENTER: [number, number] = [13.405, 52.52];
const SOURCE_ID = "melon-map-items";
const LAYER_BASE_ID = "melon-map-base";
const LAYER_ICON_ID = "melon-map-icon";
const LAYER_BADGE_ID = "melon-map-badge";
const LAYER_CORNER_ID = "melon-map-corner";
const LAYER_LABEL_ID = "melon-map-label";
const LAYER_HIT_ID = "melon-map-hit";
const TRANSIT_SOURCE_ID = "berlin-transit-overlay";
const TRANSIT_LINE_LAYER_ID = "berlin-transit-lines";
const TRANSIT_STATION_HALO_LAYER_ID = "berlin-transit-station-halo";
const TRANSIT_STATION_DOT_LAYER_ID = "berlin-transit-station-dot";
const TRANSIT_STATION_LABEL_LAYER_ID = "berlin-transit-station-label";
const DEFAULT_LIGHT_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const DEFAULT_DARK_STYLE = "https://tiles.openfreemap.org/styles/dark";
const TRANSIT_OVERLAY_URL = "/transit/berlin-transit.geojson";

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
      data: { features: [], type: "FeatureCollection" },
      type: "geojson",
    });
  }

  if (!map.getLayer(LAYER_HIT_ID)) {
    map.addLayer({
      id: LAYER_HIT_ID,
      paint: {
        "circle-opacity": 0.01,
        "circle-radius": 44,
      },
      source: SOURCE_ID,
      type: "circle",
    });
  }
}

function moveAppMarkerLayersToTop(map: maplibregl.Map) {
  [LAYER_BASE_ID, LAYER_ICON_ID, LAYER_BADGE_ID, LAYER_CORNER_ID, LAYER_LABEL_ID, LAYER_HIT_ID].forEach((layerId) => {
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
        badgeFill: "#223033",
        badgeFreeText: "#87d7a1",
        badgePaidText: "#ffb2c1",
        badgeStroke: "#456066",
        circleStroke: "#fff4df",
        group: "#62a58e",
        groupOwner: "#ffd166",
        halo: "#0f1517",
        labelColor: "#fff7f2",
        selected: "#ffd166",
        session: "#ff6b7f",
        venue: "#35b97f",
        viewerAttending: "#ffd166",
      }
    : {
        badgeCountText: "#231d1c",
        badgeFill: "#fffdfa",
        badgeFreeText: "#2c8b61",
        badgePaidText: "#d54762",
        badgeStroke: "#e5d6d0",
        circleStroke: "#fff4df",
        group: "#4d9a76",
        groupOwner: "#d49e2f",
        halo: "#fffdfa",
        labelColor: "#231d1c",
        selected: "#f6b73c",
        session: "#f05f78",
        venue: "#20a669",
        viewerAttending: "#f6b73c",
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
    return { featureCollection: { features, type: "FeatureCollection" } as SimpleFeatureCollection, lookup };
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
    return { featureCollection: { features, type: "FeatureCollection" } as SimpleFeatureCollection, lookup };
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

  return { featureCollection: { features, type: "FeatureCollection" } as SimpleFeatureCollection, lookup };
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

function updateLayerTheme(map: maplibregl.Map, theme: "dark" | "light") {
  const palette = currentThemePalette(theme);
  if (map.getLayer(LAYER_BASE_ID)) {
    map.setPaintProperty(LAYER_BASE_ID, "circle-color", markerColorExpression(palette));
    map.setPaintProperty(LAYER_BASE_ID, "circle-stroke-color", palette.circleStroke);
  }
  if (map.getLayer(LAYER_LABEL_ID)) {
    map.setPaintProperty(LAYER_LABEL_ID, "text-color", palette.labelColor);
    map.setPaintProperty(LAYER_LABEL_ID, "text-halo-color", palette.halo);
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
      "text-color": theme === "dark" ? "#6f8588" : "#4f727c",
      "text-halo-color": theme === "dark" ? "#10181a" : "#fff7f0",
      "text-halo-width": 1.25,
      "text-opacity": ["interpolate", ["linear"], ["zoom"], 9, 0, 10, theme === "dark" ? 0.32 : 0.6],
    },
    source: TRANSIT_SOURCE_ID,
    type: "symbol",
  });
}

function updateTransitOverlayTheme(map: maplibregl.Map, theme: "dark" | "light") {
  if (map.getLayer(TRANSIT_LINE_LAYER_ID)) {
    map.setPaintProperty(TRANSIT_LINE_LAYER_ID, "line-opacity", theme === "dark" ? 0.26 : 0.42);
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
  if (map.getLayer(TRANSIT_STATION_LABEL_LAYER_ID)) {
    map.setPaintProperty(TRANSIT_STATION_LABEL_LAYER_ID, "text-color", theme === "dark" ? "#6f8588" : "#4f727c");
    map.setPaintProperty(TRANSIT_STATION_LABEL_LAYER_ID, "text-halo-color", theme === "dark" ? "#10181a" : "#fff7f0");
    map.setPaintProperty(
      TRANSIT_STATION_LABEL_LAYER_ID,
      "text-opacity",
      ["interpolate", ["linear"], ["zoom"], 9, 0, 10, theme === "dark" ? 0.32 : 0.6],
    );
  }
}

function collapseMapAttribution(map: maplibregl.Map) {
  const container = map.getContainer();
  container.querySelectorAll<HTMLElement>(".maplibregl-ctrl-attrib.maplibregl-compact-show").forEach((control) => {
    control.classList.remove("maplibregl-compact-show");
  });
  container
    .querySelectorAll<HTMLButtonElement>(".maplibregl-ctrl-attrib-button[aria-expanded='true']")
    .forEach((button) => {
      button.setAttribute("aria-expanded", "false");
    });
}

function addLayers(map: maplibregl.Map, theme: "dark" | "light", transitData: TransitFeatureCollection | null) {
  const palette = currentThemePalette(theme);
  applyTransitBoost(map, theme);
  addTransitOverlay(map, theme, transitData);
  updateTransitOverlayTheme(map, theme);
  ensureMarkerSourceAndHitLayer(map);

  if (!map.getLayer(LAYER_BASE_ID)) {
    map.addLayer({
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

  if (!map.getLayer(LAYER_ICON_ID)) {
    map.addLayer({
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

  if (!map.getLayer(LAYER_BADGE_ID)) {
    map.addLayer({
      filter: ["!=", ["get", "badge"], ""],
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

  if (!map.getLayer(LAYER_CORNER_ID)) {
    map.addLayer({
      filter: ["!=", ["get", "cornerIcon"], ""],
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
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const lookupRef = useRef<Map<string, MarkerLookupEntry>>(new Map());
  const interactionsBoundRef = useRef(false);
  const appliedStyleRef = useRef<string | null>(null);
  const optimisticSelectedKeyRef = useRef<SelectedMarkerKey>(null);
  const centeredSelectionRef = useRef<string | null>(null);
  const suppressBackgroundClickRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [transitData, setTransitData] = useState<TransitFeatureCollection | null>(null);

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
          setTransitData(data as TransitFeatureCollection);
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
      const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
      source?.setData(
        featureCollectionWithSelectedKey(sourceDataRef.current.featureCollection, nextSelectedKey) as never,
      );
      map.triggerRepaint();
    };

    const markerLayerIds = [LAYER_HIT_ID, LAYER_BASE_ID, LAYER_ICON_ID, LAYER_LABEL_ID, LAYER_BADGE_ID, LAYER_CORNER_ID];

    const handleMapClick = (event: maplibregl.MapMouseEvent) => {
      const hitBox = 32;
      const features = map.queryRenderedFeatures(
        [
          [event.point.x - hitBox, event.point.y - hitBox],
          [event.point.x + hitBox, event.point.y + hitBox],
        ],
        { layers: markerLayerIds.filter((layerId) => map.getLayer(layerId)) },
      );
      const feature = features.find((item) => item.properties?.lookupKey);
      const lookupKey = feature?.properties?.lookupKey;

      if (lookupKey) {
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

      if (suppressBackgroundClickRef.current) {
        suppressBackgroundClickRef.current = false;
        return;
      }
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

    const handleLoad = async () => {
      ensureMarkerSourceAndHitLayer(map);
      lookupRef.current = sourceDataRef.current.lookup;
      const initialSource = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
      initialSource?.setData(
        featureCollectionWithSelectedKey(sourceDataRef.current.featureCollection, optimisticSelectedKeyRef.current) as never,
      );
      await ensureBaseAssets(map);
      await ensureBadgeAssets(map, sourceDataRef.current.featureCollection.features, themeRef.current);
      addLayers(map, themeRef.current, transitDataRef.current);
      const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
      source?.setData(
        featureCollectionWithSelectedKey(sourceDataRef.current.featureCollection, optimisticSelectedKeyRef.current) as never,
      );
      moveAppMarkerLayersToTop(map);
      map.triggerRepaint();
      popupRef.current ??= new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 18 });
      if (!interactionsBoundRef.current) {
        map.on("click", handleMapClick);
        [LAYER_HIT_ID, LAYER_BASE_ID, LAYER_ICON_ID, LAYER_LABEL_ID, LAYER_BADGE_ID, LAYER_CORNER_ID].forEach((layerId) => {
          map.on("mousemove", layerId, handleHover);
          map.on("mouseleave", layerId, clearHover);
        });
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
    mapRef.current = map;

    return () => {
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
      interactionsBoundRef.current = false;
      setMapReady(false);
    };
  }, [currentStyle, currentStyleKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!selectedLocation) {
      centeredSelectionRef.current = null;
    }
    if (!map || !mapReady || !selectedLocation) {
      return;
    }
    if (centeredSelectionRef.current === selectedLocation.id) {
      return;
    }

    centeredSelectionRef.current = selectedLocation.id;
    map.easeTo({
      center: [selectedLocation.longitude, selectedLocation.latitude],
      duration: 650,
      essential: true,
      zoom: Math.max(map.getZoom(), 12.2),
    });
  }, [mapReady, selectedLocation]);

  useLayoutEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedKey) {
      return;
    }
    collapseMapAttribution(map);
  }, [selectedKey]);

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
    const currentSource = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    currentSource?.setData(
      featureCollectionWithSelectedKey(sourceData.featureCollection, selectedMarkerKey) as never,
    );
    map.triggerRepaint();

    void (async () => {
      await ensureBaseAssets(map);
      await ensureBadgeAssets(map, sourceData.featureCollection.features, theme);
      if (!active) {
        return;
      }
      ensureMarkerSourceAndHitLayer(map);
      addLayers(map, theme, transitData);
      updateLayerTheme(map, theme);
      const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
      source?.setData(
        featureCollectionWithSelectedKey(sourceData.featureCollection, optimisticSelectedKeyRef.current) as never,
      );
      moveAppMarkerLayersToTop(map);
      map.triggerRepaint();
    })();

    return () => {
      active = false;
    };
  }, [mapReady, selectionRevision, selectedKey, sourceData, theme, transitData]);

  return <div className="map-stage" ref={mapContainerRef} />;
}
