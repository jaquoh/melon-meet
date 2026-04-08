import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import type { GroupSummary, MeetingSummary, VenueSummary } from "../../../../packages/shared/src";

interface BoundsValue {
  east: number;
  north: number;
  south: number;
  west: number;
}

interface GroupPin {
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
  selectedKey?: string | null;
  theme: "dark" | "light";
  venueMeetingsById?: Record<string, MeetingSummary[]>;
  venues: VenueSummary[];
}

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
    icon: string;
    kind: "group" | "session" | "venue";
    label: string;
    lookupKey: string;
    selected: 0 | 1;
  };
  type: "Feature";
};

type SimpleFeatureCollection = {
  features: SimpleFeature[];
  type: "FeatureCollection";
};

const BERLIN_CENTER: [number, number] = [13.405, 52.52];
const SOURCE_ID = "melon-map-items";
const LAYER_BASE_ID = "melon-map-base";
const LAYER_ICON_ID = "melon-map-icon";
const LAYER_BADGE_ID = "melon-map-badge";
const LAYER_LABEL_ID = "melon-map-label";
const LAYER_HIT_ID = "melon-map-hit";

function popupHtml(title: string, lines: string[]) {
  return `<div class="map-popup"><strong>${title}</strong>${lines.map((line) => `<span>${line}</span>`).join("")}</div>`;
}

function svgDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function iconSvg(kind: "group" | "session" | "venue") {
  if (kind === "session") {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 32 32" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <rect x="6.5" y="8.5" width="19" height="17" rx="4"/>
        <path d="M10 5.5v5"/>
        <path d="M22 5.5v5"/>
        <path d="M7 13.5h18"/>
      </svg>
    `;
  }
  if (kind === "venue") {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 32 32" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16 26.5c5.1-6 8-10.1 8-13.6a8 8 0 1 0-16 0c0 3.5 2.9 7.6 8 13.6Z"/>
        <circle cx="16" cy="13" r="3.2"/>
      </svg>
    `;
  }
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 32 32" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3.3"/>
      <circle cx="20.5" cy="13.5" r="2.8"/>
      <path d="M6.5 23c1.8-3.5 4.4-5.2 7.7-5.2S20.1 19.5 22 23"/>
      <path d="M17.3 23c1.2-2.4 3.1-3.6 5.5-3.6 1.1 0 2.2.3 3.2.8"/>
    </svg>
  `;
}

function badgeIconId(theme: "dark" | "light", label: string, accent: string) {
  return `melon-badge-${theme}-${accent.replace(/[^a-z0-9]/gi, "")}-${label.replace(/[^a-z0-9]/gi, "").toLowerCase()}`;
}

function badgeSvg(theme: "dark" | "light", label: string, accent: string) {
  const width = Math.max(30, Math.round(label.length * 7.4 + 16));
  const pixelWidth = width * 2;
  const pixelHeight = 40;
  const fill = theme === "dark" ? "#1e1719" : "#fffdfa";
  const stroke = theme === "dark" ? "#4a383d" : "#e5d6d0";
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${pixelWidth}" height="${pixelHeight}" viewBox="0 0 ${width} 20" fill="none">
      <rect x="0.75" y="0.75" width="${width - 1.5}" height="18.5" rx="9.25" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
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
    ensureMapIcon(map, "melon-icon-session", iconSvg("session")),
    ensureMapIcon(map, "melon-icon-venue", iconSvg("venue")),
  ]);
}

async function ensureBadgeAssets(map: maplibregl.Map, features: SimpleFeature[], theme: "dark" | "light") {
  const badges = new Map<string, { accent: string; label: string }>();
  for (const feature of features) {
    const { badge, badgeIcon } = feature.properties;
    if (!badge) {
      continue;
    }
    const accent = badge === "Free" ? "#2c8b61" : "#231d1c";
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

function currentThemePalette(theme: "dark" | "light") {
  return theme === "dark"
    ? {
        circleStroke: "#120f11",
        halo: "#120f11",
        labelColor: "#fff7f5",
      }
    : {
        circleStroke: "#fffdfa",
        halo: "#fffdfa",
        labelColor: "#231d1c",
      };
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
      const lookupKey = `venue:${venue.id}`;
      lookup.set(lookupKey, {
        kind: "venue",
        popupLines: [
          venue.address,
          meetingsAtVenue[0] ? `Next: ${meetingsAtVenue[0].title}` : "No sessions yet",
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
          badgeIcon: badgeIconId(theme, badge, badge === "Free" ? "#2c8b61" : "#231d1c"),
          icon: "melon-icon-venue",
          kind: "venue",
          label: venue.name,
          lookupKey,
          selected: selectedKey === lookupKey || selectedKey === venue.id ? 1 : 0,
        },
        type: "Feature",
      });
    }
    return { featureCollection: { features, type: "FeatureCollection" } as SimpleFeatureCollection, lookup };
  }

  if (mode === "groups") {
    for (const pin of groupPins) {
      const badge = pin.group.publicSessionCount > 0 ? `${pin.group.publicSessionCount}x` : "";
      const lookupKey = `group:${pin.group.id}`;
      lookup.set(lookupKey, {
        group: pin.group,
        kind: "group",
        popupLines: [
          pin.group.visibility,
          pin.nextMeeting ? `Next: ${pin.nextMeeting.title}` : "No session scheduled",
          `${pin.group.publicSessionCount} public sessions`,
        ],
        popupTitle: pin.group.name,
      });
      features.push({
        geometry: { coordinates: [pin.longitude, pin.latitude], type: "Point" },
        properties: {
          attending: 0,
          badge,
          badgeIcon: badgeIconId(theme, badge, "#231d1c"),
          icon: "melon-icon-group",
          kind: "group",
          label: pin.group.name,
          lookupKey,
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
    const accent = sameLocation.length > 1 || representative.pricing !== "free" ? "#231d1c" : "#2c8b61";
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
              `Next: ${representative.shortName || representative.title}`,
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
        icon: "melon-icon-session",
        kind: "session",
        label: sameLocation.length > 1 ? representative.locationName : representative.shortName || representative.title,
        lookupKey,
        selected: selectedKey === lookupKey || sameLocation.some((item) => item.id === selectedKey) ? 1 : 0,
      },
      type: "Feature",
    });
  }

  return { featureCollection: { features, type: "FeatureCollection" } as SimpleFeatureCollection, lookup };
}

function updateLayerTheme(map: maplibregl.Map, theme: "dark" | "light") {
  const palette = currentThemePalette(theme);
  if (map.getLayer(LAYER_BASE_ID)) {
    map.setPaintProperty(LAYER_BASE_ID, "circle-stroke-color", palette.circleStroke);
  }
  if (map.getLayer(LAYER_LABEL_ID)) {
    map.setPaintProperty(LAYER_LABEL_ID, "text-color", palette.labelColor);
    map.setPaintProperty(LAYER_LABEL_ID, "text-halo-color", palette.halo);
  }
}

function addLayers(map: maplibregl.Map, theme: "dark" | "light") {
  if (map.getSource(SOURCE_ID)) {
    updateLayerTheme(map, theme);
    return;
  }

  const palette = currentThemePalette(theme);

  map.addSource(SOURCE_ID, {
    data: { features: [], type: "FeatureCollection" },
    type: "geojson",
  });

  map.addLayer({
    id: LAYER_BASE_ID,
    paint: {
      "circle-color": [
        "case",
        ["==", ["get", "selected"], 1],
        "#f05f78",
        ["==", ["get", "attending"], 1],
        "#2c8b61",
        [
          "match",
          ["get", "kind"],
          "venue",
          "#2a8b72",
          "session",
          "#2f4f80",
          "#6b5c8f",
        ],
      ],
      "circle-radius": ["case", ["==", ["get", "selected"], 1], 18, 16],
      "circle-stroke-color": palette.circleStroke,
      "circle-stroke-width": 2,
    },
    source: SOURCE_ID,
    type: "circle",
  });

  map.addLayer({
    id: LAYER_ICON_ID,
    layout: {
      "icon-allow-overlap": true,
      "icon-anchor": "center",
      "icon-image": ["get", "icon"],
      "icon-size": 0.88,
    },
    source: SOURCE_ID,
    type: "symbol",
  });

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

  map.addLayer({
    id: LAYER_LABEL_ID,
    layout: {
      "text-allow-overlap": true,
      "text-anchor": "top",
      "text-field": ["get", "label"],
      "text-font": ["IBM Plex Mono SemiBold"],
      "text-max-width": 10,
      "text-offset": [0, 2.35],
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

  map.addLayer({
    id: LAYER_HIT_ID,
    paint: {
      "circle-opacity": 0,
      "circle-radius": 34,
    },
    source: SOURCE_ID,
    type: "circle",
  });
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
  selectedKey,
  theme,
  venueMeetingsById = {},
  venues,
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const lookupRef = useRef<Map<string, MarkerLookupEntry>>(new Map());
  const suppressBackgroundClickRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);

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

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      attributionControl: { compact: true },
      center: BERLIN_CENTER,
      container: mapContainerRef.current,
      style: import.meta.env.VITE_MAP_STYLE_URL ?? "https://tiles.openfreemap.org/styles/liberty",
      zoom: 10.8,
    });

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

    const handleMapClick = () => {
      if (suppressBackgroundClickRef.current) {
        suppressBackgroundClickRef.current = false;
        return;
      }
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
      popupRef.current?.setLngLat(coordinates).setHTML(popupHtml(lookup.popupTitle, lookup.popupLines)).addTo(map);
    };

    const clearHover = () => {
      map.getCanvas().style.cursor = "";
      popupRef.current?.remove();
    };

    const handleFeatureClick = (event: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      suppressBackgroundClickRef.current = true;
      const feature = event.features?.[0];
      const lookupKey = feature?.properties?.lookupKey;
      if (!lookupKey) {
        return;
      }
      const lookup = lookupRef.current.get(String(lookupKey));
      if (!lookup) {
        return;
      }
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
    };

    const handleLoad = async () => {
      await ensureBaseAssets(map);
      addLayers(map, theme);
      popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 18 });
      map.on("click", handleMapClick);
      [LAYER_HIT_ID, LAYER_BASE_ID, LAYER_ICON_ID, LAYER_LABEL_ID, LAYER_BADGE_ID].forEach((layerId) => {
        map.on("click", layerId, handleFeatureClick);
        map.on("mousemove", layerId, handleHover);
        map.on("mouseleave", layerId, clearHover);
      });
      map.on("movestart", clearHover);
      map.on("load", syncBounds);
      map.on("moveend", syncBounds);
      syncBounds();
      setMapReady(true);
    };

    map.once("load", () => {
      void handleLoad();
    });
    mapRef.current = map;

    return () => {
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }

    lookupRef.current = sourceData.lookup;
    void ensureBadgeAssets(map, sourceData.featureCollection.features, theme);
    addLayers(map, theme);
    updateLayerTheme(map, theme);
    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    source?.setData(sourceData.featureCollection as never);
  }, [mapReady, sourceData, theme]);

  return <div className="map-stage" ref={mapContainerRef} />;
}
