import { useEffect, useRef } from "react";
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
  venues: VenueSummary[];
}

const BERLIN_CENTER: [number, number] = [13.405, 52.52];

export function MapView({
  draftLocation,
  meetings,
  onBoundsChange,
  onDraftLocationChange,
  onMeetingSelect,
  onVenueSelect,
  venues,
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const venueMarkersRef = useRef<Marker[]>([]);
  const meetingMarkersRef = useRef<Marker[]>([]);
  const draftMarkerRef = useRef<Marker | null>(null);

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      attributionControl: { compact: false },
      center: BERLIN_CENTER,
      container: mapContainerRef.current,
      style:
        import.meta.env.VITE_MAP_STYLE_URL ??
        "https://tiles.openfreemap.org/styles/liberty",
      zoom: 10.9,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => {
      const bounds = map.getBounds();
      onBoundsChange({
        east: bounds.getEast(),
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        west: bounds.getWest(),
      });
    });

    map.on("moveend", () => {
      const bounds = map.getBounds();
      onBoundsChange({
        east: bounds.getEast(),
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        west: bounds.getWest(),
      });
    });

    map.on("click", (event) => {
      onDraftLocationChange({
        latitude: Number(event.lngLat.lat.toFixed(6)),
        longitude: Number(event.lngLat.lng.toFixed(6)),
      });
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [onBoundsChange, onDraftLocationChange]);

  useEffect(() => {
    venueMarkersRef.current.forEach((marker) => marker.remove());
    venueMarkersRef.current = venues.map((venue) => {
      const button = document.createElement("button");
      button.className = `flex h-11 w-11 items-center justify-center rounded-full border-2 border-white text-xs font-semibold text-white shadow-lg ${
        venue.pricing === "free" ? "bg-teal-500" : "bg-orange-500"
      }`;
      button.type = "button";
      button.textContent = venue.pricing === "free" ? "F" : "€";
      button.addEventListener("click", () => onVenueSelect(venue));

      const popup = new maplibregl.Popup({ offset: 18 }).setHTML(
        `<div class="min-w-[180px]">
          <p style="font-weight:700;margin:0 0 4px">${venue.name}</p>
          <p style="margin:0;color:#57534e;font-size:12px">${venue.address}</p>
        </div>`,
      );

      return new maplibregl.Marker({ element: button })
        .setLngLat([venue.longitude, venue.latitude])
        .setPopup(popup)
        .addTo(mapRef.current!);
    });
  }, [onVenueSelect, venues]);

  useEffect(() => {
    meetingMarkersRef.current.forEach((marker) => marker.remove());
    meetingMarkersRef.current = meetings.map((meeting) => {
      const button = document.createElement("button");
      button.className =
        "min-w-16 rounded-full border border-white/80 bg-stone-900/90 px-3 py-1.5 text-xs font-semibold text-white shadow-lg";
      button.type = "button";
      button.textContent = `${meeting.claimedSpots}/${meeting.capacity}`;
      button.addEventListener("click", () => onMeetingSelect(meeting));

      const popup = new maplibregl.Popup({ offset: 18 }).setHTML(
        `<div class="min-w-[220px]">
          <p style="font-weight:700;margin:0 0 4px">${meeting.title}</p>
          <p style="margin:0;color:#57534e;font-size:12px">${meeting.groupName}</p>
          <p style="margin:4px 0 0;color:#57534e;font-size:12px">${meeting.claimedSpots}/${meeting.capacity} spots claimed</p>
        </div>`,
      );

      return new maplibregl.Marker({ element: button })
        .setLngLat([meeting.longitude, meeting.latitude])
        .setPopup(popup)
        .addTo(mapRef.current!);
    });
  }, [meetings, onMeetingSelect]);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    if (!draftLocation) {
      draftMarkerRef.current?.remove();
      draftMarkerRef.current = null;
      return;
    }

    const marker =
      draftMarkerRef.current ??
      new maplibregl.Marker({
        color: "#0f172a",
        draggable: true,
      })
        .setLngLat([draftLocation.longitude, draftLocation.latitude])
        .addTo(mapRef.current);

    marker.setLngLat([draftLocation.longitude, draftLocation.latitude]);
    marker.on("dragend", () => {
      const lngLat = marker.getLngLat();
      onDraftLocationChange({
        latitude: Number(lngLat.lat.toFixed(6)),
        longitude: Number(lngLat.lng.toFixed(6)),
      });
    });

    draftMarkerRef.current = marker;
  }, [draftLocation, onDraftLocationChange]);

  return <div className="map-shell min-h-[70vh] w-full overflow-hidden rounded-[32px]" ref={mapContainerRef} />;
}
