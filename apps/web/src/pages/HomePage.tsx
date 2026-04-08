import { useDeferredValue, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import type { MeetingSummary, VenueSummary, ViewerSummary } from "../../../../packages/shared/src";
import { EventTimeline } from "../components/EventTimeline";
import { MapView } from "../components/MapView";
import { claimMeeting, getGroups, getMap, getMe, unclaimMeeting } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { createNavigationState } from "../lib/navigation";
import { queryClient } from "../lib/query-client";

const INITIAL_BOUNDS = {
  east: 13.7611,
  north: 52.6755,
  openOnly: false,
  pricing: "all" as const,
  south: 52.3383,
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

type MapMode = "groups" | "sessions" | "venues";
type TimePreset = "custom" | "next-weekend" | "this-month" | "this-week" | "today" | "tomorrow";

interface HomeBounds {
  east: number;
  north: number;
  openOnly: boolean;
  pricing: "all" | "free" | "paid";
  south: number;
  west: number;
}

interface GroupPin {
  activityLabel: string | null;
  description: string;
  id: string;
  latitude: number;
  longitude: number;
  memberCount: number;
  name: string;
  nextMeeting: MeetingSummary;
  publicSessionCount: number;
}

type PanelContext =
  | { type: "default" }
  | { group: GroupPin; type: "group" }
  | { type: "venue"; venue: VenueSummary };

function toIso(date: Date) {
  return new Date(date).toISOString();
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function startOfWeek(date: Date) {
  const start = startOfLocalDay(date);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  return start;
}

function endOfWeek(date: Date) {
  const end = startOfWeek(date);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function resolveTimeWindow(preset: TimePreset, customStartAt: string, customEndAt: string) {
  const now = new Date();
  const today = startOfLocalDay(now);

  if (preset === "today") {
    return {
      endAt: toIso(endOfLocalDay(today)),
      startAt: toIso(today),
    };
  }

  if (preset === "tomorrow") {
    const tomorrow = startOfLocalDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));
    return {
      endAt: toIso(endOfLocalDay(tomorrow)),
      startAt: toIso(tomorrow),
    };
  }

  if (preset === "this-week") {
    return {
      endAt: toIso(endOfWeek(now)),
      startAt: toIso(now),
    };
  }

  if (preset === "this-month") {
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return {
      endAt: toIso(monthEnd),
      startAt: toIso(now),
    };
  }

  if (preset === "next-weekend") {
    const nextSaturday = startOfLocalDay(now);
    const day = nextSaturday.getDay();
    const offset = day === 6 ? 7 : ((6 - day + 7) % 7) || 7;
    nextSaturday.setDate(nextSaturday.getDate() + offset);
    const nextSundayEnd = endOfLocalDay(
      new Date(nextSaturday.getFullYear(), nextSaturday.getMonth(), nextSaturday.getDate() + 1),
    );
    return {
      endAt: toIso(nextSundayEnd),
      startAt: toIso(nextSaturday),
    };
  }

  return {
    endAt: customEndAt ? new Date(customEndAt).toISOString() : undefined,
    startAt: customStartAt ? new Date(customStartAt).toISOString() : undefined,
  };
}

export function HomePage({ viewer }: { viewer: ViewerSummary | null }) {
  const location = useLocation();
  const [bounds, setBounds] = useState<HomeBounds>(INITIAL_BOUNDS);
  const [selectedVenue, setSelectedVenue] = useState<VenueSummary | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingSummary | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<GroupPin | null>(null);
  const [panelContext, setPanelContext] = useState<PanelContext>({ type: "default" });
  const [draftLocation, setDraftLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showClaimedOnly, setShowClaimedOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [mapMode, setMapMode] = useState<MapMode>("sessions");
  const [timePreset, setTimePreset] = useState<TimePreset>("this-week");
  const [customStartAt, setCustomStartAt] = useState(formatDateInput(new Date()));
  const [customEndAt, setCustomEndAt] = useState("");
  const deferredBounds = useDeferredValue(bounds);
  const timeWindow = useMemo(
    () => resolveTimeWindow(timePreset, customStartAt, customEndAt),
    [customEndAt, customStartAt, timePreset],
  );

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
        east: deferredBounds.east,
        endAt: mapMode === "sessions" ? timeWindow.endAt : undefined,
        north: deferredBounds.north,
        openOnly: mapMode === "sessions" ? deferredBounds.openOnly : false,
        pricing: deferredBounds.pricing,
        south: deferredBounds.south,
        startAt: mapMode === "sessions" ? timeWindow.startAt : undefined,
        west: deferredBounds.west,
      }),
    queryKey: ["map", deferredBounds, mapMode, timeWindow.endAt, timeWindow.startAt],
  });

  const nextEventsQuery = useQuery({
    queryFn: () => getMap(DISCOVERY_BOUNDS),
    queryKey: ["map", "member-upcoming"],
  });

  const claimMutation = useMutation({
    mutationFn: async (meeting: MeetingSummary) =>
      meeting.viewerHasClaimed ? unclaimMeeting(meeting.id) : claimMeeting(meeting.id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["map"] }),
        queryClient.invalidateQueries({ queryKey: ["meeting"] }),
        queryClient.invalidateQueries({ queryKey: ["map", "member-upcoming"] }),
      ]);
    },
  });

  const myGroupIds = new Set((meQuery.data?.groups ?? []).map((group) => group.id));
  const allDiscoveryMeetings = nextEventsQuery.data?.meetings ?? [];

  const upcomingTimelineMeetings = useMemo(() => {
    return [...allDiscoveryMeetings]
      .filter((meeting) => (viewer ? true : meeting.groupVisibility === "public"))
      .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime())
      .slice(0, 18);
  }, [allDiscoveryMeetings, viewer]);

  const visibleUpcomingMeetings = useMemo(
    () =>
      showClaimedOnly
        ? upcomingTimelineMeetings.filter((meeting) => meeting.viewerHasClaimed)
        : upcomingTimelineMeetings,
    [showClaimedOnly, upcomingTimelineMeetings],
  );

  const venueMeetingsById = useMemo(() => {
    return allDiscoveryMeetings.reduce<Record<string, MeetingSummary[]>>((accumulator, meeting) => {
      if (!meeting.venueId) {
        return accumulator;
      }

      const current = accumulator[meeting.venueId] ?? [];
      accumulator[meeting.venueId] = [...current, meeting];
      return accumulator;
    }, {});
  }, [allDiscoveryMeetings]);

  const meetingsByGroupId = useMemo(() => {
    return allDiscoveryMeetings.reduce<Record<string, MeetingSummary[]>>((accumulator, meeting) => {
      const current = accumulator[meeting.groupId] ?? [];
      accumulator[meeting.groupId] = [...current, meeting];
      return accumulator;
    }, {});
  }, [allDiscoveryMeetings]);

  const publicSessionsByGroup = useMemo(() => {
    return allDiscoveryMeetings.reduce<Record<string, MeetingSummary[]>>((accumulator, meeting) => {
      if (meeting.groupVisibility !== "public") {
        return accumulator;
      }

      const current = accumulator[meeting.groupId] ?? [];
      accumulator[meeting.groupId] = [...current, meeting];
      return accumulator;
    }, {});
  }, [allDiscoveryMeetings]);

  const groupPins = useMemo(() => {
    return (groupsQuery.data?.groups ?? [])
      .filter((group) => group.visibility === "public")
      .map((group) => {
        const sessions = publicSessionsByGroup[group.id] ?? [];
        const nextMeeting = sessions[0];
        if (!nextMeeting) {
          return null;
        }

        return {
          activityLabel: group.activityLabel,
          description: group.description,
          id: group.id,
          latitude: nextMeeting.latitude,
          longitude: nextMeeting.longitude,
          memberCount: group.memberCount,
          name: group.name,
          nextMeeting,
          publicSessionCount: sessions.length,
        } satisfies GroupPin;
      })
      .filter((group): group is GroupPin => Boolean(group));
  }, [groupsQuery.data?.groups, publicSessionsByGroup]);

  const selectedVenueMeetings = selectedVenue ? venueMeetingsById[selectedVenue.id] ?? [] : [];
  const selectedGroupMeetings = selectedGroup ? publicSessionsByGroup[selectedGroup.id] ?? [] : [];
  const selectedMeetingGroupMeetings = selectedMeeting
    ? (meetingsByGroupId[selectedMeeting.groupId] ?? []).filter((meeting) => meeting.id !== selectedMeeting.id)
    : [];
  const myMeetingsCount = allDiscoveryMeetings.filter((meeting) => meeting.viewerHasClaimed).length;
  const homeNavigationState = createNavigationState(location, "Open access");

  const resetPanel = () => {
    setSelectedMeeting(null);
    setSelectedVenue(null);
    setSelectedGroup(null);
    setPanelContext({ type: "default" });
  };

  const openMeetingInRail = (meeting: MeetingSummary, context: PanelContext = { type: "default" }) => {
    setSelectedGroup(null);
    setSelectedVenue(null);
    setSelectedMeeting(meeting);
    setPanelContext(context);
  };

  const handleBack = () => {
    if (selectedMeeting && panelContext.type === "group") {
      setSelectedMeeting(null);
      setSelectedGroup(panelContext.group);
      setPanelContext({ type: "default" });
      return;
    }

    if (selectedMeeting && panelContext.type === "venue") {
      setSelectedMeeting(null);
      setSelectedVenue(panelContext.venue);
      setPanelContext({ type: "default" });
      return;
    }

    resetPanel();
  };

  const currentGroupContext = selectedGroup ?? (panelContext.type === "group" ? panelContext.group : null);
  const currentVenueContext = selectedVenue ?? (panelContext.type === "venue" ? panelContext.venue : null);

  const railConfig = useMemo(() => {
    if (currentGroupContext) {
      return {
        emptyLabel: "No public sessions are attached to this group yet.",
        heading: `${currentGroupContext.name} sessions`,
        meetings: publicSessionsByGroup[currentGroupContext.id] ?? [],
        secondaryMeta: "location" as const,
        showGroupLabel: false,
      };
    }

    if (currentVenueContext) {
      return {
        emptyLabel: "No sessions are scheduled at this venue right now.",
        heading: `${currentVenueContext.name} sessions`,
        meetings: venueMeetingsById[currentVenueContext.id] ?? [],
        secondaryMeta: "group" as const,
        showGroupLabel: true,
      };
    }

    if (selectedMeeting) {
      return {
        emptyLabel: "No additional sessions from this group are scheduled right now.",
        heading: "More from this group",
        meetings: selectedMeetingGroupMeetings,
        secondaryMeta: "location" as const,
        showGroupLabel: false,
      };
    }

    return {
      emptyLabel: viewer ? "No upcoming public or member sessions yet." : "No public sessions are scheduled right now.",
      heading: viewer ? "Upcoming sessions" : "Upcoming public sessions",
      meetings: visibleUpcomingMeetings,
      secondaryMeta: "group-and-location" as const,
      showGroupLabel: true,
    };
  }, [
    currentGroupContext,
    currentVenueContext,
    publicSessionsByGroup,
    selectedMeeting,
    selectedMeetingGroupMeetings,
    venueMeetingsById,
    viewer,
    visibleUpcomingMeetings,
  ]);

  const railTop = useMemo(() => {
    if (selectedMeeting) {
      const backLabel =
        panelContext.type === "group"
          ? "Back to group"
          : panelContext.type === "venue"
            ? "Back to venue"
            : "Close";

      return (
        <div className="workspace-rail__summary stack-sm">
          <div className="workspace-rail__bar">
            <div>
              <p className="eyebrow">Session</p>
              <h3 className="section-title">{selectedMeeting.title}</h3>
            </div>
            <button className="button-secondary button-inline" onClick={handleBack} type="button">
              {backLabel}
            </button>
          </div>

          <p className="muted-copy">{selectedMeeting.description || "Session details stay here while the map keeps its place."}</p>

          <div className="workspace-rail__meta">
            <div>
              <p className="terminal-item__meta">When</p>
              <p className="terminal-item__title">{formatDateTime(selectedMeeting.startsAt)}</p>
            </div>
            <div>
              <p className="terminal-item__meta">Group</p>
              <p className="terminal-item__title">{selectedMeeting.groupName}</p>
            </div>
            <div>
              <p className="terminal-item__meta">Venue</p>
              <p className="terminal-item__title">{selectedMeeting.locationName}</p>
            </div>
          </div>

          <div className="workspace-rail__actions">
            <Link className="button-primary" state={homeNavigationState} to={`/meetings/${selectedMeeting.id}`}>
              Open page
            </Link>
            {viewer ? (
              <button
                className={selectedMeeting.viewerHasClaimed ? "button-accent" : "button-secondary"}
                disabled={claimMutation.isPending}
                onClick={() => claimMutation.mutate(selectedMeeting)}
                type="button"
              >
                {selectedMeeting.viewerHasClaimed ? "Release" : "Claim spot"}
              </button>
            ) : null}
          </div>
        </div>
      );
    }

    if (selectedGroup) {
      return (
        <div className="workspace-rail__summary stack-sm">
          <div className="workspace-rail__bar">
            <div>
              <p className="eyebrow">Group</p>
              <h3 className="section-title">{selectedGroup.name}</h3>
            </div>
            <button className="button-secondary button-inline" onClick={resetPanel} type="button">
              Close
            </button>
          </div>

          <p className="muted-copy">{selectedGroup.description}</p>

          <div className="workspace-rail__meta">
            <div>
              <p className="terminal-item__meta">Visibility</p>
              <p className="terminal-item__title">Public</p>
            </div>
            <div>
              <p className="terminal-item__meta">Members</p>
              <p className="terminal-item__title">{selectedGroup.memberCount}</p>
            </div>
            <div>
              <p className="terminal-item__meta">Sessions</p>
              <p className="terminal-item__title">{selectedGroup.publicSessionCount}</p>
            </div>
          </div>

          <div className="workspace-rail__actions">
            <Link className="button-primary" state={homeNavigationState} to={`/groups/${selectedGroup.id}`}>
              Open page
            </Link>
          </div>
        </div>
      );
    }

    if (selectedVenue) {
      return (
        <div className="workspace-rail__summary stack-sm">
          <div className="workspace-rail__bar">
            <div>
              <p className="eyebrow">Venue</p>
              <h3 className="section-title">{selectedVenue.name}</h3>
            </div>
            <button className="button-secondary button-inline" onClick={resetPanel} type="button">
              Close
            </button>
          </div>

          <p className="muted-copy">{selectedVenue.description}</p>
          <p className="terminal-item__meta">{selectedVenue.address}</p>

          <div className="workspace-rail__meta">
            <div>
              <p className="terminal-item__meta">Pricing</p>
              <p className="terminal-item__title">{selectedVenue.pricing}</p>
            </div>
            <div>
              <p className="terminal-item__meta">Sessions</p>
              <p className="terminal-item__title">{selectedVenueMeetings.length}</p>
            </div>
          </div>

          <div className="workspace-rail__actions">
            <Link className="button-primary" state={homeNavigationState} to={`/venues/${selectedVenue.id}`}>
              Open page
            </Link>
            {selectedVenue.sourceUrl ? (
              <a className="button-secondary" href={selectedVenue.sourceUrl} rel="noreferrer" target="_blank">
                Source
              </a>
            ) : null}
          </div>
        </div>
      );
    }

    return (
      <div className="workspace-rail__summary stack-sm">
        <div className="workspace-rail__bar">
          <div>
            <p className="eyebrow">At a glance</p>
            <h3 className="section-title">Public board</h3>
          </div>
        </div>

        <p className="muted-copy">Browse the live board, then open a venue, group, or session without losing the map.</p>

        <div className="metrics-grid metrics-grid--compact">
          <div className="metric-box">
            <p className="metric-box__value">{mapQuery.data?.meetings.length ?? 0}</p>
            <p className="metric-box__label">Sessions</p>
          </div>
          <div className="metric-box">
            <p className="metric-box__value">{groupPins.length}</p>
            <p className="metric-box__label">Groups</p>
          </div>
          <div className="metric-box">
            <p className="metric-box__value">{mapQuery.data?.venues.length ?? 0}</p>
            <p className="metric-box__label">Venues</p>
          </div>
          <div className="metric-box metric-box--accent">
            <p className="metric-box__value">{myMeetingsCount}</p>
            <p className="metric-box__label">Claimed</p>
          </div>
        </div>
      </div>
    );
  }, [
    claimMutation,
    groupPins.length,
    handleBack,
    homeNavigationState,
    mapQuery.data?.meetings.length,
    mapQuery.data?.venues.length,
    myMeetingsCount,
    resetPanel,
    selectedGroup,
    selectedMeeting,
    selectedVenue,
    selectedVenueMeetings.length,
    viewer,
  ]);

  const timelineSelectionContext =
    selectedGroup
      ? ({ group: selectedGroup, type: "group" } as const)
      : selectedVenue
        ? ({ type: "venue", venue: selectedVenue } as const)
        : panelContext.type !== "default"
          ? panelContext
          : ({ type: "default" } as const);

  return (
    <div className="page-wrap page-wrap--workspace map-page">
      <section className="workspace-board">
        <aside className="board-column">
          <div className="board-column__header">
            <div>
              <p className="eyebrow">
                {selectedMeeting ? "Session" : selectedGroup ? "Group" : selectedVenue ? "Venue" : "At a glance"}
              </p>
              <h2 className="section-title typewriter-title">
                {selectedMeeting
                  ? selectedMeeting.title
                  : selectedGroup
                    ? selectedGroup.name
                    : selectedVenue
                      ? selectedVenue.name
                      : "At a glance"}
              </h2>
            </div>
            {selectedMeeting || selectedGroup || selectedVenue ? (
              <button className="button-secondary button-inline" onClick={resetPanel} type="button">
                Close
              </button>
            ) : (
              <span className="badge">{viewer ? "Signed in" : "Open access"}</span>
            )}
          </div>

          <div className="board-column__body">{railTop}</div>
        </aside>

        <div className="board-column">
          <div className="board-column__header">
            <div>
              <p className="eyebrow">Map</p>
              <h2 className="section-title typewriter-title">Berlin board</h2>
            </div>
            <div className="compact-badges">
              <span className="badge-outline">Berlin</span>
            </div>
          </div>

          <div className="board-column__body board-column__body--map">
            <MapView
              draftLocation={draftLocation}
              groupPins={mapMode === "groups" ? groupPins : []}
              meetings={mapMode === "sessions" ? mapQuery.data?.meetings ?? [] : []}
              onBoundsChange={(next) => setBounds((current) => ({ ...current, ...next }))}
              onDraftLocationChange={setDraftLocation}
              onGroupSelect={(group) => {
                setSelectedMeeting(null);
                setSelectedVenue(null);
                setSelectedGroup(group);
                setPanelContext({ type: "default" });
              }}
              onMeetingSelect={(meeting) => openMeetingInRail(meeting)}
              onVenueSelect={(venue) => {
                setSelectedMeeting(null);
                setSelectedGroup(null);
                setSelectedVenue(venue);
                setPanelContext({ type: "default" });
              }}
              venueMeetingsById={venueMeetingsById}
              venues={mapMode === "venues" ? mapQuery.data?.venues ?? [] : []}
            />

            <div className="map-surface-overlay map-surface-overlay--topbar">
              <div className="mode-switch mode-switch--compact mode-switch--triple map-mode-switch">
                <button
                  className={`mode-switch__button ${mapMode === "sessions" ? "is-active" : ""}`}
                  onClick={() => {
                    setMapMode("sessions");
                    setShowFilters(false);
                    resetPanel();
                  }}
                  type="button"
                >
                  Sessions
                </button>
                <button
                  className={`mode-switch__button ${mapMode === "groups" ? "is-active" : ""}`}
                  onClick={() => {
                    setMapMode("groups");
                    setShowFilters(false);
                    resetPanel();
                  }}
                  type="button"
                >
                  Groups
                </button>
                <button
                  className={`mode-switch__button ${mapMode === "venues" ? "is-active" : ""}`}
                  onClick={() => {
                    setMapMode("venues");
                    setShowFilters(false);
                    resetPanel();
                  }}
                  type="button"
                >
                  Venues
                  </button>
                </div>

              <div className="map-filter-menu">
                <button
                  className={`button-secondary button-inline map-filter-menu__button ${showFilters ? "is-active" : ""}`}
                  onClick={() => setShowFilters((current) => !current)}
                  type="button"
                >
                  Filters
                </button>

                {showFilters ? (
                  <div className="map-filter-popover stack-sm">
                    <div className="editorial-topline">
                      <p className="eyebrow">Map filters</p>
                      <span className="editorial-tag">public access</span>
                    </div>

                    {mapMode === "sessions" ? (
                      <div className="filter-chip-row">
                        {[
                          ["today", "Today"],
                          ["tomorrow", "Tomorrow"],
                          ["next-weekend", "Next weekend"],
                          ["this-week", "This week"],
                          ["this-month", "This month"],
                          ["custom", "Custom"],
                        ].map(([value, label]) => (
                          <button
                            className={`filter-chip ${timePreset === value ? "filter-chip--active" : ""}`}
                            key={value}
                            onClick={() => setTimePreset(value as TimePreset)}
                            type="button"
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {mapMode === "sessions" && timePreset === "custom" ? (
                      <div className="form-grid">
                        <label className="field-stack">
                          <span className="field-label">Start</span>
                          <input
                            className="field-input"
                            onChange={(event) => setCustomStartAt(event.target.value)}
                            type="datetime-local"
                            value={customStartAt}
                          />
                        </label>
                        <label className="field-stack">
                          <span className="field-label">End</span>
                          <input
                            className="field-input"
                            onChange={(event) => setCustomEndAt(event.target.value)}
                            type="datetime-local"
                            value={customEndAt}
                          />
                        </label>
                      </div>
                    ) : null}

                    <div className="form-grid form-grid--two">
                      <label className="field-stack">
                        <span className="field-label">Pricing</span>
                        <select
                          className="field-select"
                          onChange={(event) =>
                            setBounds((current) => ({
                              ...current,
                              pricing: event.target.value as "all" | "free" | "paid",
                            }))
                          }
                          value={bounds.pricing}
                        >
                          <option value="all">All</option>
                          <option value="free">Free</option>
                          <option value="paid">Paid</option>
                        </select>
                      </label>

                      {mapMode === "sessions" ? (
                        <label className="field-check">
                          <input
                            checked={bounds.openOnly}
                            onChange={(event) =>
                              setBounds((current) => ({
                                ...current,
                                openOnly: event.target.checked,
                              }))
                            }
                            type="checkbox"
                          />
                          Open spots only
                        </label>
                      ) : null}
                    </div>
                  </div>
                  ) : null}
                </div>
              </div>
            </div>
        </div>

        <aside className="board-column">
          <div className="board-column__header">
            <div>
              <p className="eyebrow">Upcoming sessions</p>
              <h2 className="section-title typewriter-title">{railConfig.heading}</h2>
            </div>
            {viewer ? (
              <button
                className={showClaimedOnly ? "button-accent button-inline" : "button-secondary button-inline"}
                onClick={() => setShowClaimedOnly((current) => !current)}
                type="button"
              >
                {showClaimedOnly ? "Show all" : "Only claimed"}
              </button>
            ) : null}
          </div>

          <div className="board-column__body">
              <EventTimeline
                contextLabel="Open access"
                emptyAction={
                  !viewer ? (
                    <div className="form-actions form-actions--start">
                      <Link className="button-primary button-inline" to="/auth">
                        Sign in
                      </Link>
                    </div>
                  ) : null
                }
                emptyLabel={railConfig.emptyLabel}
                heading={railConfig.heading}
                meetings={railConfig.meetings}
                memberGroupIds={myGroupIds}
                onSelectMeeting={(meeting) => openMeetingInRail(meeting, timelineSelectionContext)}
                secondaryMeta={railConfig.secondaryMeta}
                showHeader={false}
                showGroupLabel={railConfig.showGroupLabel}
                variant="embedded"
              />
          </div>
        </aside>
      </section>
    </div>
  );
}
