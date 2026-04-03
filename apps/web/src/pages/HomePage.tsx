import { useDeferredValue, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { MeetingSummary, VenueSummary, ViewerSummary } from "../../../../packages/shared/src";
import { MapView } from "../components/MapView";
import { MeetingForm } from "../components/MeetingForm";
import { PanelCard } from "../components/PanelCard";
import { claimMeeting, createMeeting, getGroups, getMap, unclaimMeeting } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { queryClient } from "../lib/query-client";

const INITIAL_BOUNDS = {
  east: 13.7611,
  endAt: "",
  north: 52.6755,
  openOnly: false,
  pricing: "all" as const,
  south: 52.3383,
  startAt: "",
  west: 13.0884,
};

interface HomeFilters {
  east: number;
  endAt: string;
  north: number;
  openOnly: boolean;
  pricing: "all" | "free" | "paid";
  south: number;
  startAt: string;
  west: number;
}

export function HomePage({ viewer }: { viewer: ViewerSummary | null }) {
  const [filters, setFilters] = useState<HomeFilters>(INITIAL_BOUNDS);
  const [selectedVenue, setSelectedVenue] = useState<VenueSummary | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingSummary | null>(null);
  const [draftLocation, setDraftLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const deferredFilters = useDeferredValue(filters);

  const groupsQuery = useQuery({
    queryFn: getGroups,
    queryKey: ["groups"],
  });

  const mapQuery = useQuery({
    queryFn: () =>
      getMap({
        east: deferredFilters.east,
        endAt: deferredFilters.endAt || undefined,
        north: deferredFilters.north,
        openOnly: deferredFilters.openOnly,
        pricing: deferredFilters.pricing,
        south: deferredFilters.south,
        startAt: deferredFilters.startAt || undefined,
        west: deferredFilters.west,
      }),
    queryKey: ["map", deferredFilters],
  });

  const claimMutation = useMutation({
    mutationFn: async (meeting: MeetingSummary) =>
      meeting.viewerHasClaimed
        ? unclaimMeeting(meeting.id)
        : claimMeeting(meeting.id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["map"] }),
        queryClient.invalidateQueries({ queryKey: ["meeting"] }),
      ]);
    },
  });

  const createMeetingMutation = useMutation({
    mutationFn: createMeeting,
    onSuccess: async () => {
      setShowCreateForm(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["map"] }),
        queryClient.invalidateQueries({ queryKey: ["groups"] }),
      ]);
    },
  });

  const selectedCard = useMemo(() => {
    if (selectedMeeting) {
      return (
        <PanelCard className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-500">
                Meeting
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-stone-900">{selectedMeeting.title}</h2>
            </div>
            <span className="rounded-full bg-stone-900 px-3 py-1 text-xs font-medium text-white">
              {selectedMeeting.claimedSpots}/{selectedMeeting.capacity}
            </span>
          </div>
          <p className="text-sm leading-7 text-stone-600">
            {selectedMeeting.description || "No description yet."}
          </p>
          <dl className="grid gap-3 text-sm text-stone-600">
            <div>
              <dt className="font-medium text-stone-900">When</dt>
              <dd>{formatDateTime(selectedMeeting.startsAt)}</dd>
            </div>
            <div>
              <dt className="font-medium text-stone-900">Where</dt>
              <dd>{selectedMeeting.locationName}</dd>
            </div>
            <div>
              <dt className="font-medium text-stone-900">Group</dt>
              <dd>{selectedMeeting.groupName}</dd>
            </div>
            <div>
              <dt className="font-medium text-stone-900">Open spots</dt>
              <dd>{selectedMeeting.openSpots}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-3">
            <Link className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-900 hover:text-stone-900" to={`/meetings/${selectedMeeting.id}`}>
              View meeting
            </Link>
            {viewer ? (
              <button
                className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={claimMutation.isPending}
                onClick={() => claimMutation.mutate(selectedMeeting)}
                type="button"
              >
                {selectedMeeting.viewerHasClaimed ? "Release spot" : "Claim spot"}
              </button>
            ) : (
              <Link className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700" to="/auth">
                Sign in to join
              </Link>
            )}
          </div>
        </PanelCard>
      );
    }

    if (selectedVenue) {
      return (
        <PanelCard className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-500">
                Venue
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-stone-900">{selectedVenue.name}</h2>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${selectedVenue.pricing === "free" ? "bg-teal-100 text-teal-700" : "bg-orange-100 text-orange-700"}`}>
              {selectedVenue.pricing}
            </span>
          </div>
          <p className="text-sm leading-7 text-stone-600">{selectedVenue.description}</p>
          <div className="rounded-3xl bg-stone-50 px-4 py-4 text-sm text-stone-600">
            <p className="font-medium text-stone-900">Address</p>
            <p className="mt-1">{selectedVenue.address}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700"
              onClick={() => {
                setShowCreateForm(true);
                setDraftLocation({
                  latitude: selectedVenue.latitude,
                  longitude: selectedVenue.longitude,
                });
              }}
              type="button"
            >
              Meet here
            </button>
            {selectedVenue.sourceUrl ? (
              <a className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-900 hover:text-stone-900" href={selectedVenue.sourceUrl} rel="noreferrer" target="_blank">
                Venue source
              </a>
            ) : null}
          </div>
        </PanelCard>
      );
    }

    return (
      <PanelCard className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-500">
          Berlin map
        </p>
        <h2 className="text-2xl font-semibold text-stone-900">
          Tap a court or a meeting marker to inspect the details here.
        </h2>
        <p className="text-sm leading-7 text-stone-600">
          The map keeps the venue layer visible for public browsing, while meeting markers react to your time, pricing, and open-spot filters.
        </p>
      </PanelCard>
    );
  }, [claimMutation, selectedMeeting, selectedVenue, viewer]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid gap-5 xl:grid-cols-[1.45fr,0.55fr]">
        <section className="space-y-5">
          <PanelCard className="space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-orange-500">
                  Map filters
                </p>
                <h1 className="mt-1 text-3xl font-semibold text-stone-900 sm:text-4xl">
                  Find courts, open spots, and the next game outside.
                </h1>
              </div>
              <button
                className="rounded-full bg-gradient-to-r from-orange-500 to-teal-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-orange-200 transition hover:scale-[1.01]"
                onClick={() => setShowCreateForm((value) => !value)}
                type="button"
              >
                {showCreateForm ? "Hide create form" : "Create meeting"}
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <label className="space-y-2">
                <span className="text-sm font-medium text-stone-600">Pricing</span>
                <select className="block w-full rounded-2xl border-stone-200 bg-stone-50 px-4 py-3 text-sm" onChange={(event) => setFilters((current) => ({ ...current, pricing: event.target.value as "all" | "free" | "paid" }))} value={filters.pricing}>
                  <option value="all">All</option>
                  <option value="free">Free</option>
                  <option value="paid">Paid</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-stone-600">Starts after</span>
                <input className="block w-full rounded-2xl border-stone-200 bg-stone-50 px-4 py-3 text-sm" onChange={(event) => setFilters((current) => ({ ...current, startAt: event.target.value ? new Date(event.target.value).toISOString() : "" }))} type="datetime-local" />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-stone-600">Starts before</span>
                <input className="block w-full rounded-2xl border-stone-200 bg-stone-50 px-4 py-3 text-sm" onChange={(event) => setFilters((current) => ({ ...current, endAt: event.target.value ? new Date(event.target.value).toISOString() : "" }))} type="datetime-local" />
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
                <input checked={filters.openOnly} onChange={(event) => setFilters((current) => ({ ...current, openOnly: event.target.checked }))} type="checkbox" />
                Only show meetings with open spots
              </label>

              <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-500">
                Map location filter is driven by the current viewport. Pan or zoom Berlin to narrow results.
              </div>
            </div>
          </PanelCard>

          {showCreateForm ? (
            <PanelCard>
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-500">
                    Create meeting
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-stone-900">
                    {selectedVenue ? `New meetup at ${selectedVenue.name}` : "Create from the map or by exact coordinates"}
                  </h2>
                </div>
                {viewer ? null : (
                  <Link className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700" to="/auth">
                    Sign in first
                  </Link>
                )}
              </div>

              {viewer ? (
                <MeetingForm
                  groups={groupsQuery.data?.groups ?? []}
                  initialLocation={
                    selectedVenue
                      ? {
                        latitude: selectedVenue.latitude,
                        locationAddress: selectedVenue.address,
                        locationName: selectedVenue.name,
                        longitude: selectedVenue.longitude,
                        venueId: selectedVenue.id,
                      }
                      : draftLocation
                        ? {
                          latitude: draftLocation.latitude,
                          locationAddress: `Dropped pin at ${draftLocation.latitude}, ${draftLocation.longitude}`,
                          locationName: "Custom map location",
                          longitude: draftLocation.longitude,
                          venueId: null,
                        }
                        : null
                  }
                  onSubmit={async (payload) => {
                    await createMeetingMutation.mutateAsync(payload);
                  }}
                />
              ) : (
                <p className="rounded-3xl border border-dashed border-stone-200 bg-stone-50 px-4 py-5 text-sm text-stone-500">
                  Public browsing stays open, but meeting creation requires an account.
                </p>
              )}
            </PanelCard>
          ) : null}

          <MapView
            draftLocation={draftLocation}
            meetings={mapQuery.data?.meetings ?? []}
            onBoundsChange={(bounds) => setFilters((current) => ({ ...current, ...bounds }))}
            onDraftLocationChange={setDraftLocation}
            onMeetingSelect={(meeting) => {
              setSelectedVenue(null);
              setSelectedMeeting(meeting);
            }}
            onVenueSelect={(venue) => {
              setSelectedMeeting(null);
              setSelectedVenue(venue);
            }}
            venues={mapQuery.data?.venues ?? []}
          />
        </section>

        <aside className="space-y-5">
          {selectedCard}

          <PanelCard>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-500">
                  Live counts
                </p>
                <h2 className="mt-1 text-xl font-semibold text-stone-900">What the map is showing</h2>
              </div>
              {mapQuery.isFetching ? (
                <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-500">
                  refreshing
                </span>
              ) : null}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-3xl bg-stone-50 px-4 py-4">
                <p className="text-3xl font-semibold text-stone-900">{mapQuery.data?.venues.length ?? 0}</p>
                <p className="mt-1 text-sm text-stone-500">Berlin venues in view</p>
              </div>
              <div className="rounded-3xl bg-stone-50 px-4 py-4">
                <p className="text-3xl font-semibold text-stone-900">{mapQuery.data?.meetings.length ?? 0}</p>
                <p className="mt-1 text-sm text-stone-500">Public or member-visible meetings</p>
              </div>
            </div>
          </PanelCard>
        </aside>
      </div>
    </div>
  );
}
