import { useEffect, useEffectEvent, useRef } from "react";
import maplibregl, { Marker } from "maplibre-gl";
import type { MeetingSummary, VenueSummary } from "../../../../packages/shared/src";

interface BoundsValue {
  east: number;
  north: number;
  south: number;
  west: number;
}

interface DraftLocation {
  latitude: number;
  longitude: number;
}

interface MapViewProps {
  draftLocation: DraftLocation | null;
  meetings: MeetingSummary[];
  onBoundsChange: (bounds: BoundsValue) => void;
  onDraftLocationChange: (location: DraftLocation) => void;
  onMeetingSelect: (meeting: MeetingSummary) => void;
  onVenueSelect: (venue: VenueSummary) => void;
  venueMeetingsById?: Record<string, MeetingSummary[]>;
  venues: VenueSummary[];
}

const BERLIN_CENTER: [number, number] = [13.405, 52.52];

function popupMarkup(title: string, lines: string[], tag?: string) {
  return `
    <div class="map-popup">
      ${tag ? `<span class="map-popup__tag">${tag}</span>` : ""}
      <p class="map-popup__title">${title}</p>
      ${lines.map((line) => `<p class="map-popup__meta">${line}</p>`).join("")}
    </div>
  `;
}

function wireHoverPopup(marker: Marker, popup: maplibregl.Popup, button: HTMLButtonElement) {
  let hoverTimer: number | null = null;

  const openPopup = () => {
    if (hoverTimer) {
      window.clearTimeout(hoverTimer);
      hoverTimer = null;
    }
    if (!popup.isOpen()) {
      marker.togglePopup();
    }
  };

  const closePopup = () => {
    hoverTimer = window.setTimeout(() => {
      if (popup.isOpen()) {
        popup.remove();
      }
    }, 90);
  };

  button.addEventListener("mouseenter", openPopup);
  button.addEventListener("mouseleave", closePopup);

  popup.on("open", () => {
    const popupElement = popup.getElement();
    popupElement?.addEventListener("mouseenter", openPopup);
    popupElement?.addEventListener("mouseleave", closePopup);
  });
}

export function MapView({
  draftLocation,
  meetings,
  onBoundsChange,
  onDraftLocationChange,
  onMeetingSelect,
  onVenueSelect,
  venueMeetingsById = {},
  venues,
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const venueMarkersRef = useRef<Marker[]>([]);
  const meetingMarkersRef = useRef<Marker[]>([]);
  const draftMarkerRef = useRef<Marker | null>(null);

  const emitBoundsChange = useEffectEvent(onBoundsChange);
  const emitDraftLocationChange = useEffectEvent(onDraftLocationChange);
  const emitMeetingSelect = useEffectEvent(onMeetingSelect);
  const emitVenueSelect = useEffectEvent(onVenueSelect);

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      attributionControl: { compact: false },
      center: BERLIN_CENTER,
      container: mapContainerRef.current,
      style: import.meta.env.VITE_MAP_STYLE_URL ?? "https://tiles.openfreemap.org/styles/liberty",
      zoom: 10.9,
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

    map.on("load", syncBounds);
    map.on("moveend", syncBounds);
    map.on("click", (event) => {
      emitDraftLocationChange({
        latitude: Number(event.lngLat.lat.toFixed(6)),
        longitude: Number(event.lngLat.lng.toFixed(6)),
      });
    });

    mapRef.current = map;

    return () => {
      venueMarkersRef.current.forEach((marker) => marker.remove());
      meetingMarkersRef.current.forEach((marker) => marker.remove());
      draftMarkerRef.current?.remove();
      venueMarkersRef.current = [];
      meetingMarkersRef.current = [];
      draftMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    venueMarkersRef.current.forEach((marker) => marker.remove());
    venueMarkersRef.current = venues.map((venue) => {
      const button = document.createElement("button");
      button.className = "map-pin map-pin--venue";
      button.type = "button";
      const venueMeetings = venueMeetingsById[venue.id] ?? [];
      const nextMeeting = venueMeetings[0];
      button.textContent = venueMeetings.length > 0 ? String(venueMeetings.length) : venue.pricing === "free" ? "FREE" : "PAID";
      button.addEventListener("click", () => emitVenueSelect(venue));

      const popup = new maplibregl.Popup({ closeButton: false, offset: 16 }).setHTML(
        popupMarkup(
          venue.name,
          [
            venue.address,
            nextMeeting ? `Next: ${formatMeetingWindow(nextMeeting)}` : "No scheduled meetings",
            nextMeeting ? nextMeeting.title : venue.pricing,
          ],
          venueMeetings.length > 0 ? `${venueMeetings.length} events` : undefined,
        ),
      );

      const marker = new maplibregl.Marker({ element: button })
        .setLngLat([venue.longitude, venue.latitude])
        .setPopup(popup)
        .addTo(map);

      wireHoverPopup(marker, popup, button);
      return marker;
    });
  }, [emitVenueSelect, venueMeetingsById, venues]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    meetingMarkersRef.current.forEach((marker) => marker.remove());
    meetingMarkersRef.current = meetings.map((meeting) => {
      const button = document.createElement("button");
      button.className = `map-pin map-pin--meeting ${meeting.viewerHasClaimed ? "map-pin--claimed" : ""}`.trim();
      button.type = "button";
      button.textContent = meeting.viewerHasClaimed ? "YOU" : `${meeting.claimedSpots}/${meeting.capacity}`;
      button.addEventListener("click", () => emitMeetingSelect(meeting));

      const popup = new maplibregl.Popup({ closeButton: false, offset: 16 }).setHTML(
        popupMarkup(
          meeting.title,
          [
            meeting.groupName,
            formatMeetingWindow(meeting),
            `${meeting.claimedSpots}/${meeting.capacity} spots claimed`,
          ],
          meeting.viewerHasClaimed ? "You're attending" : undefined,
        ),
      );

      const marker = new maplibregl.Marker({ element: button })
        .setLngLat([meeting.longitude, meeting.latitude])
        .setPopup(popup)
        .addTo(map);

      wireHoverPopup(marker, popup, button);
      return marker;
    });
  }, [emitMeetingSelect, meetings]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (!draftLocation) {
      draftMarkerRef.current?.remove();
      draftMarkerRef.current = null;
      return;
    }

    if (!draftMarkerRef.current) {
      const draftElement = document.createElement("div");
      draftElement.className = "map-pin map-pin--draft";

      const marker = new maplibregl.Marker({
        draggable: true,
        element: draftElement,
      })
        .setLngLat([draftLocation.longitude, draftLocation.latitude])
        .addTo(map);

      marker.on("dragend", () => {
        const lngLat = marker.getLngLat();
        emitDraftLocationChange({
          latitude: Number(lngLat.lat.toFixed(6)),
          longitude: Number(lngLat.lng.toFixed(6)),
        });
      });

      draftMarkerRef.current = marker;
    }

    draftMarkerRef.current.setLngLat([draftLocation.longitude, draftLocation.latitude]);
  }, [draftLocation, emitDraftLocationChange]);

  return <div className="map-shell" ref={mapContainerRef} />;
}

function formatMeetingWindow(meeting: MeetingSummary) {
  const date = new Date(meeting.startsAt);
  const dateLabel = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
  const timeLabel = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${dateLabel} · ${timeLabel}`;
}
