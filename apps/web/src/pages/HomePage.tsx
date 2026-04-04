import { useDeferredValue, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import type { MeetingSummary, VenueSummary, ViewerSummary } from "../../../../packages/shared/src";
import { EventTimeline } from "../components/EventTimeline";
import { MapView } from "../components/MapView";
import { MeetingForm } from "../components/MeetingForm";
import { PanelCard } from "../components/PanelCard";
import { claimMeeting, createMeeting, getGroups, getMap, getMe, unclaimMeeting } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { createNavigationState } from "../lib/navigation";
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

const DISCOVERY_BOUNDS = {
  east: 180,
  north: 90,
  openOnly: false,
  pricing: "all" as const,
  south: -90,
  startAt: new Date().toISOString(),
  west: -180,
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
  const location = useLocation();
  const [filters, setFilters] = useState<HomeFilters>(INITIAL_BOUNDS);
  const [selectedVenue, setSelectedVenue] = useState<VenueSummary | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingSummary | null>(null);
  const [draftLocation, setDraftLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showClaimedOnly, setShowClaimedOnly] = useState(false);
  const [mapLayer, setMapLayer] = useState<"meetings" | "venues">("meetings");
  const deferredFilters = useDeferredValue(filters);

  const meQuery = useQuery({
    queryFn: getMe,
    queryKey: ["me"],
  });

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

  const nextEventsQuery = useQuery({
    queryFn: () => getMap(DISCOVERY_BOUNDS),
    queryKey: ["map", "member-upcoming"],
  });

  const claimMutation = useMutation({
    mutationFn: async (meeting: MeetingSummary) => (meeting.viewerHasClaimed ? unclaimMeeting(meeting.id) : claimMeeting(meeting.id)),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["map"] }),
        queryClient.invalidateQueries({ queryKey: ["meeting"] }),
        queryClient.invalidateQueries({ queryKey: ["map", "member-upcoming"] }),
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
        queryClient.invalidateQueries({ queryKey: ["map", "member-upcoming"] }),
      ]);
    },
  });

  const myGroupIds = new Set((meQuery.data?.groups ?? []).map((group) => group.id));
  const upcomingTimelineMeetings = useMemo(() => {
    const meetings = nextEventsQuery.data?.meetings ?? [];

    return [...meetings]
      .filter((meeting) => (viewer ? true : meeting.groupVisibility === "public"))
      .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime())
      .slice(0, 10);
  }, [nextEventsQuery.data?.meetings, viewer]);

  const visibleUpcomingMeetings = useMemo(
    () =>
      showClaimedOnly
        ? upcomingTimelineMeetings.filter((meeting) => meeting.viewerHasClaimed)
        : upcomingTimelineMeetings,
    [showClaimedOnly, upcomingTimelineMeetings],
  );

  const myMeetingsCount = (nextEventsQuery.data?.meetings ?? []).filter((meeting) => meeting.viewerHasClaimed).length;
  const venueMeetingsById = useMemo(() => {
    return (nextEventsQuery.data?.meetings ?? []).reduce<Record<string, MeetingSummary[]>>((accumulator, meeting) => {
      if (!meeting.venueId) {
        return accumulator;
      }

      const current = accumulator[meeting.venueId] ?? [];
      accumulator[meeting.venueId] = [...current, meeting];
      return accumulator;
    }, {});
  }, [nextEventsQuery.data?.meetings]);
  const selectedVenueMeetings = selectedVenue ? venueMeetingsById[selectedVenue.id] ?? [] : [];
  const nextVenueMeeting = selectedVenueMeetings[0] ?? null;
  const homeNavigationState = createNavigationState(location, "Map board");
  const mapMeetings = mapLayer === "meetings" ? mapQuery.data?.meetings ?? [] : [];
  const mapVenues = mapLayer === "venues" ? mapQuery.data?.venues ?? [] : [];

  const selectedCard = useMemo(() => {
    if (selectedMeeting) {
      return (
        <PanelCard className={`stack-sm ${selectedMeeting.viewerHasClaimed ? "panel-card--attending" : ""}`}>
          <div className="terminal-item__row">
            <div>
              <p className="eyebrow">Meeting detail</p>
              <h2 className="section-title">{selectedMeeting.title}</h2>
            </div>
            <div className="compact-badges">
              {selectedMeeting.viewerHasClaimed ? <span className="badge-accent">Attending</span> : null}
              <span className="badge-invert">
                {selectedMeeting.claimedSpots}/{selectedMeeting.capacity}
              </span>
            </div>
          </div>

          <p className="muted-copy">{selectedMeeting.description || "No description yet."}</p>

          <div className="detail-grid detail-grid--two">
            <div className="terminal-item">
              <p className="terminal-item__meta">When</p>
              <p className="terminal-item__title">{formatDateTime(selectedMeeting.startsAt)}</p>
            </div>
            <div className="terminal-item">
              <p className="terminal-item__meta">Where</p>
              <p className="terminal-item__title">{selectedMeeting.locationName}</p>
            </div>
            <div className="terminal-item">
              <p className="terminal-item__meta">Group</p>
              <p className="terminal-item__title">{selectedMeeting.groupName}</p>
            </div>
            <div className="terminal-item">
              <p className="terminal-item__meta">Open spots</p>
              <p className="terminal-item__title">{selectedMeeting.openSpots}</p>
            </div>
          </div>

          <div className="form-actions form-actions--start">
            <Link className="button-secondary" state={homeNavigationState} to={`/meetings/${selectedMeeting.id}`}>
              View meeting
            </Link>
            <Link className="button-secondary" state={homeNavigationState} to={`/groups/${selectedMeeting.groupId}`}>
              Open group
            </Link>
            {selectedMeeting.venueId ? (
              <Link className="button-secondary" state={homeNavigationState} to={`/venues/${selectedMeeting.venueId}`}>
                Open venue
              </Link>
            ) : null}
            {viewer ? (
              <button
                className={selectedMeeting.viewerHasClaimed ? "button-accent" : "button-primary"}
                disabled={claimMutation.isPending}
                onClick={() => claimMutation.mutate(selectedMeeting)}
                type="button"
              >
                {selectedMeeting.viewerHasClaimed ? "Release spot" : "Claim spot"}
              </button>
            ) : (
              <Link className="button-primary" to="/auth">
                Sign in to join
              </Link>
            )}
          </div>
        </PanelCard>
      );
    }

    if (selectedVenue) {
      return (
        <PanelCard className="stack-sm">
          <div className="terminal-item__row">
            <div>
              <p className="eyebrow">Venue detail</p>
              <h2 className="section-title">{selectedVenue.name}</h2>
            </div>
            <span className="badge-outline">{selectedVenue.pricing}</span>
          </div>

          <p className="muted-copy">{selectedVenue.description}</p>

          <div className="terminal-item">
            <p className="terminal-item__meta">Address</p>
            <p className="terminal-item__title">{selectedVenue.address}</p>
          </div>

          {nextVenueMeeting ? (
            <div className="terminal-item">
              <p className="terminal-item__meta">Next meeting here</p>
              <div className="stack-sm">
                <p className="terminal-item__title">{nextVenueMeeting.title}</p>
                <p className="terminal-item__meta">{formatDateTime(nextVenueMeeting.startsAt)}</p>
                <p className="terminal-item__meta">{nextVenueMeeting.groupName}</p>
              </div>
            </div>
          ) : (
            <p className="empty-state">No scheduled meetings at this venue yet.</p>
          )}

          {selectedVenueMeetings.length > 0 ? (
            <div className="stack-sm">
              <div className="editorial-topline">
                <p className="eyebrow">Venue schedule</p>
                <span className="editorial-tag">{selectedVenueMeetings.length} events</span>
              </div>
              <div className="stack-sm">
                {selectedVenueMeetings.slice(0, 4).map((meeting) => (
                  <Link
                    className="terminal-item terminal-item--link"
                    key={meeting.id}
                    state={homeNavigationState}
                    to={`/meetings/${meeting.id}`}
                  >
                    <div className="terminal-item__row">
                      <div>
                        <p className="terminal-item__title">{meeting.title}</p>
                        <p className="terminal-item__meta">{formatDateTime(meeting.startsAt)}</p>
                      </div>
                      <span className={meeting.viewerHasClaimed ? "badge-accent" : "badge-outline"}>
                        {meeting.groupName}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          <div className="form-actions form-actions--start">
            <button
              className="button-primary"
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
            <Link className="button-secondary" state={homeNavigationState} to={`/venues/${selectedVenue.id}`}>
              Open venue
            </Link>
            {selectedVenue.sourceUrl ? (
              <a className="button-secondary" href={selectedVenue.sourceUrl} rel="noreferrer" target="_blank">
                Venue source
              </a>
            ) : null}
          </div>
        </PanelCard>
      );
    }

    return (
      <PanelCard className="stack-sm panel-card--editorial">
        <div className="editorial-topline">
          <p className="eyebrow">Selection</p>
          <span className="editorial-tag">meeting or venue</span>
        </div>
        <h2 className="section-title">Select a venue or meeting marker to inspect details here.</h2>
        <div className="editorial-note">
          <span className="editorial-index">///</span>
          <p className="muted-copy">Switch the board between venues and meetings, then open the right-side detail card without leaving the current map context.</p>
        </div>
      </PanelCard>
    );
  }, [
    claimMutation,
    homeNavigationState,
    nextVenueMeeting,
    selectedMeeting,
    selectedVenue,
    selectedVenueMeetings,
    viewer,
  ]);

  return (
    <div className="page-wrap page-wrap--workspace">
      <section className="home-main-shell">
        <aside className="timeline-rail">
          <EventTimeline
            actions={
              viewer ? (
                <button
                  className={showClaimedOnly ? "button-accent" : "button-secondary"}
                  onClick={() => setShowClaimedOnly((value) => !value)}
                  type="button"
                >
                  {showClaimedOnly ? "Show all" : "Only claimed"}
                </button>
              ) : null
            }
            contextLabel="Map board"
            emptyAction={
              !viewer ? (
                <div className="form-actions form-actions--start">
                  <Link className="button-primary button-inline" to="/auth">
                    Sign in
                  </Link>
                </div>
              ) : null
            }
            emptyLabel={
              viewer ? "No upcoming public or member-group meetings yet." : "No public events are scheduled right now."
            }
            heading="Next events"
            meetings={visibleUpcomingMeetings}
            memberGroupIds={myGroupIds}
            secondaryMeta="group-and-location"
          />
        </aside>

        <div className="workspace-main">
          <PanelCard className="home-toolbar">
            <div className="home-toolbar__lead">
              <div className="stack-sm">
                <p className="eyebrow">Map board</p>
                <h2 className="section-title typewriter-title">Live courts, sessions, and open spots</h2>
              </div>
              <div className="home-toolbar__actions">
                <div className="mode-switch mode-switch--compact">
                  <button
                    className={`mode-switch__button ${mapLayer === "meetings" ? "is-active" : ""}`}
                    onClick={() => {
                      setMapLayer("meetings");
                      setSelectedVenue(null);
                    }}
                    type="button"
                  >
                    Meetings
                  </button>
                  <button
                    className={`mode-switch__button ${mapLayer === "venues" ? "is-active" : ""}`}
                    onClick={() => {
                      setMapLayer("venues");
                      setSelectedMeeting(null);
                    }}
                    type="button"
                  >
                    Venues
                  </button>
                </div>
                <button className="button-primary" onClick={() => setShowCreateForm((value) => !value)} type="button">
                  {showCreateForm ? "Hide create form" : "Create meeting"}
                </button>
                <div className="compact-badges">
                  <span className="badge">{mapQuery.data?.meetings.length ?? 0} meetings</span>
                  <span className="badge">{mapQuery.data?.venues.length ?? 0} venues</span>
                  {viewer ? <span className="badge-accent">{myMeetingsCount} claimed</span> : null}
                </div>
              </div>
            </div>
          </PanelCard>

          <div className="map-workspace">
            <aside className="map-sidebar map-sidebar--filters">
              <PanelCard className="stack-sm">
                <div className="editorial-topline">
                  <p className="eyebrow">Filters</p>
                  <span className="editorial-tag">viewport aware</span>
                </div>

                <div className="filter-stack">
                  <label className="field-stack">
                    <span className="field-label">Pricing</span>
                    <select
                      className="field-select"
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          pricing: event.target.value as "all" | "free" | "paid",
                        }))
                      }
                      value={filters.pricing}
                    >
                      <option value="all">All</option>
                      <option value="free">Free</option>
                      <option value="paid">Paid</option>
                    </select>
                  </label>

                  <label className="field-stack">
                    <span className="field-label">Starts after</span>
                    <input
                      className="field-input"
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          startAt: event.target.value ? new Date(event.target.value).toISOString() : "",
                        }))
                      }
                      type="datetime-local"
                    />
                  </label>

                  <label className="field-stack">
                    <span className="field-label">Starts before</span>
                    <input
                      className="field-input"
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          endAt: event.target.value ? new Date(event.target.value).toISOString() : "",
                        }))
                      }
                      type="datetime-local"
                    />
                  </label>

                  <label className="field-check">
                    <input
                      checked={filters.openOnly}
                      onChange={(event) => setFilters((current) => ({ ...current, openOnly: event.target.checked }))}
                      type="checkbox"
                    />
                    Only open spots
                  </label>
                </div>

                <div className="metrics-grid">
                  <div className="metric-box">
                    <p className="metric-box__value">{mapQuery.data?.venues.length ?? 0}</p>
                    <p className="metric-box__label">Venues in view</p>
                  </div>
                  <div className="metric-box">
                    <p className="metric-box__value">{mapQuery.data?.meetings.length ?? 0}</p>
                    <p className="metric-box__label">Meetings in view</p>
                  </div>
                </div>
              </PanelCard>
            </aside>

            <div className="map-stage map-stage--workspace">
              <div className="map-stage__frame">
                <MapView
                  draftLocation={draftLocation}
                  meetings={mapMeetings}
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
                  venueMeetingsById={venueMeetingsById}
                  venues={mapVenues}
                />
              </div>
            </div>

            <aside className="map-sidebar map-sidebar--details">
              <div className="stack-sm">
                {selectedCard}
                {viewer ? (
                  <PanelCard className="stack-sm">
                    <div className="editorial-note editorial-note--compact">
                      <span className="editorial-index">02</span>
                      <p className="muted-copy">Claimed meetings use the clearest accent on the map and in the timeline while staying in time order.</p>
                    </div>
                  </PanelCard>
                ) : null}
              </div>
            </aside>
          </div>

          {showCreateForm ? (
            <PanelCard className="stack-sm">
              <div className="terminal-item__row">
                <div>
                  <p className="eyebrow">Create meeting</p>
                  <h2 className="section-title">
                    {selectedVenue ? `New meetup at ${selectedVenue.name}` : "Create from the map or exact coordinates"}
                  </h2>
                </div>
                {viewer ? null : (
                  <Link className="button-secondary" to="/auth">
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
                <p className="empty-state">Public browsing stays open, but meeting creation requires an account.</p>
              )}
            </PanelCard>
          ) : null}
        </div>
      </section>
    </div>
  );
}
