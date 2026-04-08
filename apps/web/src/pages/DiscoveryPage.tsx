import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarRange, Filter, List, Map as MapIcon, MapPin, Users } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import type { GroupSummary, MeetingSummary, VenueSummary, ViewerSummary } from "../../../../packages/shared/src";
import type { ThemeMode } from "../App";
import { EventTimeline } from "../components/EventTimeline";
import { FilterCheckbox } from "../components/FilterCheckbox";
import { MapView } from "../components/MapView";
import { WorkspaceShell } from "../components/WorkspaceShell";
import { claimMeeting, createMembershipRequest, getGroups, getMap, unclaimMeeting } from "../lib/api";
import { createNavigationState } from "../lib/navigation";
import { queryClient } from "../lib/query-client";

type DisplayMode = "list" | "map";
type ItemMode = "groups" | "sessions" | "venues";
type TimePreset = "custom" | "next-weekend" | "this-month" | "this-week" | "today" | "tomorrow";

interface DiscoveryBounds {
  east: number;
  north: number;
  openOnly: boolean;
  pricing: "all" | "free" | "paid";
  south: number;
  west: number;
}

const INITIAL_BOUNDS: DiscoveryBounds = {
  east: 13.7611,
  north: 52.6755,
  openOnly: false,
  pricing: "all" as const,
  south: 52.3383,
  west: 13.0884,
};

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toIso(date: Date) {
  return new Date(date).toISOString();
}

function formatSessionPrice(meeting: MeetingSummary) {
  if (meeting.pricing === "free") {
    return "Free";
  }
  if (typeof meeting.costPerPerson === "number") {
    return `${meeting.costPerPerson}€ / person`;
  }
  return "Paid";
}

function windowForPreset(preset: TimePreset, customStartAt: string, customEndAt: string) {
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === "today") {
    return { endAt: toIso(new Date(dayStart.getTime() + 86400000 - 1)), startAt: toIso(dayStart) };
  }
  if (preset === "tomorrow") {
    const next = new Date(dayStart.getTime() + 86400000);
    return { endAt: toIso(new Date(next.getTime() + 86400000 - 1)), startAt: toIso(next) };
  }
  if (preset === "this-week") {
    return { endAt: toIso(new Date(now.getTime() + 6 * 86400000)), startAt: toIso(now) };
  }
  if (preset === "this-month") {
    return { endAt: toIso(new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)), startAt: toIso(now) };
  }
  if (preset === "next-weekend") {
    return { endAt: toIso(new Date(now.getTime() + 10 * 86400000)), startAt: toIso(new Date(now.getTime() + 5 * 86400000)) };
  }
  return {
    endAt: customEndAt ? new Date(customEndAt).toISOString() : undefined,
    startAt: customStartAt ? new Date(customStartAt).toISOString() : undefined,
  };
}

export function DiscoveryPage({
  initialDisplayMode,
  initialItemMode,
  onLogOut,
  theme,
  toggleTheme,
  viewer,
}: {
  initialDisplayMode: DisplayMode;
  initialItemMode: ItemMode;
  onLogOut: () => void;
  theme: ThemeMode;
  toggleTheme: () => void;
  viewer: ViewerSummary | null;
}) {
  const location = useLocation();
  const [displayMode, setDisplayMode] = useState<DisplayMode>(initialDisplayMode);
  const [itemMode, setItemMode] = useState<ItemMode>(initialItemMode);
  const [bounds, setBounds] = useState<DiscoveryBounds>(INITIAL_BOUNDS);
  const [queryBounds, setQueryBounds] = useState<DiscoveryBounds>(INITIAL_BOUNDS);
  const [timePreset, setTimePreset] = useState<TimePreset>("this-week");
  const [customStartAt, setCustomStartAt] = useState(formatDateInput(new Date()));
  const [customEndAt, setCustomEndAt] = useState(formatDateInput(new Date(Date.now() + 2 * 60 * 60 * 1000)));
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingSummary | null>(null);
  const [selectedMeetingCluster, setSelectedMeetingCluster] = useState<{
    lookupKey: string;
    meetings: MeetingSummary[];
    title: string;
  } | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<VenueSummary | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<GroupSummary | null>(null);
  const timeWindow = useMemo(
    () => windowForPreset(timePreset, customStartAt, customEndAt),
    [customEndAt, customStartAt, timePreset],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setQueryBounds((current) => {
        const next = bounds;
        const changed =
          Math.abs(current.east - next.east) > 0.0008 ||
          Math.abs(current.west - next.west) > 0.0008 ||
          Math.abs(current.north - next.north) > 0.0008 ||
          Math.abs(current.south - next.south) > 0.0008 ||
          current.openOnly !== next.openOnly ||
          current.pricing !== next.pricing;
        return changed ? next : current;
      });
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [bounds]);

  const mapQuery = useQuery({
    queryFn: () =>
      getMap({
        east: queryBounds.east,
        endAt: itemMode === "sessions" ? timeWindow.endAt : undefined,
        north: queryBounds.north,
        openOnly: queryBounds.openOnly,
        pricing: queryBounds.pricing,
        south: queryBounds.south,
        startAt: itemMode === "sessions" ? timeWindow.startAt : undefined,
        west: queryBounds.west,
      }),
    placeholderData: (previousData) => previousData,
    queryKey: ["map", queryBounds, itemMode, timeWindow.endAt, timeWindow.startAt],
    staleTime: 15000,
  });

  const groupsQuery = useQuery({
    queryFn: getGroups,
    queryKey: ["groups"],
  });

  const claimMutation = useMutation({
    mutationFn: async (meeting: MeetingSummary) =>
      meeting.viewerHasClaimed ? unclaimMeeting(meeting.id) : claimMeeting(meeting.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["map"] });
    },
  });

  const membershipMutation = useMutation({
    mutationFn: (groupId: string) => createMembershipRequest(groupId),
  });

  const meetings = mapQuery.data?.meetings ?? [];
  const venues = mapQuery.data?.venues ?? [];
  const groups = groupsQuery.data?.groups ?? [];
  const memberGroups = groups.filter((group) => group.viewerRole);
  const publicGroups = groups.filter((group) => group.visibility === "public" && !group.viewerRole);

  const venueMeetingsById = useMemo(
    () =>
      meetings.reduce<Record<string, MeetingSummary[]>>((accumulator, meeting) => {
        if (!meeting.venueId) {
          return accumulator;
        }
        accumulator[meeting.venueId] = [...(accumulator[meeting.venueId] ?? []), meeting];
        return accumulator;
      }, {}),
    [meetings],
  );

  const groupMeetingsById = useMemo(
    () =>
      meetings.reduce<Record<string, MeetingSummary[]>>((accumulator, meeting) => {
        accumulator[meeting.groupId] = [...(accumulator[meeting.groupId] ?? []), meeting];
        return accumulator;
      }, {}),
    [meetings],
  );

  const groupPins = useMemo(
    () =>
      publicGroups
        .map((group) => {
          const nextMeeting = (groupMeetingsById[group.id] ?? [])[0] ?? null;
          if (!nextMeeting) {
            return null;
          }
          return {
            group,
            latitude: nextMeeting.latitude,
            longitude: nextMeeting.longitude,
            nextMeeting,
          };
        })
        .filter((value): value is NonNullable<typeof value> => Boolean(value)),
    [groupMeetingsById, publicGroups],
  );

  const selectedTitle =
    selectedMeeting?.title ?? selectedMeetingCluster?.title ?? selectedVenue?.name ?? selectedGroup?.name ?? "";
  const listHeading = itemMode === "groups" ? "Groups:" : itemMode === "venues" ? "Venues:" : "Sessions:";
  const navState = createNavigationState(location, "Workspace");
  const selectedVenueMeetings = selectedVenue ? venueMeetingsById[selectedVenue.id] ?? [] : [];
  const selectedGroupMeetings = selectedGroup ? groupMeetingsById[selectedGroup.id] ?? [] : [];
  const hasSelection = Boolean(selectedMeeting || selectedMeetingCluster || selectedVenue || selectedGroup);
  const clearSelection = () => {
    setSelectedMeeting(null);
    setSelectedMeetingCluster(null);
    setSelectedVenue(null);
    setSelectedGroup(null);
  };
  const handleMapBackgroundClick = () => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches) {
      clearSelection();
      setShowMobileFilters(false);
    }
  };
  const selectionPanelClose = (
    <div className="workspace-selection-close">
      <button className="button-secondary button-inline" onClick={clearSelection} type="button">
        Close
      </button>
    </div>
  );

  const selectionPanel = selectedMeetingCluster ? (
    <div className="stack-panel">
      {selectionPanelClose}
      <div className="detail-card detail-card--selected">
        <div className="detail-card__eyebrow">
          <CalendarRange size={14} strokeWidth={2} />
          <span className="panel-caption">Session cluster</span>
        </div>
        <h3>{selectedMeetingCluster.title}</h3>
        <p>{selectedMeetingCluster.meetings.length} sessions at this location</p>
      </div>
      <EventTimeline
        contextLabel="Workspace"
        emptyLabel="No sessions at this location."
        heading="Sessions at this location"
        meetings={selectedMeetingCluster.meetings}
        onSelectMeeting={(meeting) => {
          setSelectedMeeting(meeting);
          setSelectedMeetingCluster(null);
          setSelectedVenue(null);
          setSelectedGroup(null);
        }}
      />
    </div>
  ) : selectedMeeting ? (
    <div className="stack-panel">
      {selectionPanelClose}
      <div className="detail-card detail-card--selected">
        <div className="detail-card__eyebrow">
          <CalendarRange size={14} strokeWidth={2} />
          <span className="panel-caption">Session</span>
        </div>
        <h3>{selectedMeeting.title}</h3>
        <p>{selectedMeeting.groupName}</p>
        <p>{selectedMeeting.locationName}</p>
        <div className="detail-card__session-tags">
          <div className="detail-card__session-tags-main">
            <span className="mini-chip">{formatSessionPrice(selectedMeeting)}</span>
            <span className="mini-chip">{`${selectedMeeting.claimedSpots}/${selectedMeeting.capacity}`}</span>
          </div>
          {selectedMeeting.viewerHasClaimed ? <span className="mini-chip mini-chip--accent">Claimed</span> : null}
        </div>
      </div>
      <div className="workspace-button-row">
        {viewer ? (
          <button className="button-primary" onClick={() => claimMutation.mutate(selectedMeeting)} type="button">
            {selectedMeeting.viewerHasClaimed ? "Release" : "Claim spot"}
          </button>
        ) : null}
        <Link className="button-secondary" state={navState} to={`/sessions/${selectedMeeting.id}`}>
          Open session
        </Link>
      </div>
    </div>
  ) : selectedVenue ? (
    <div className="stack-panel">
      {selectionPanelClose}
      <div className="detail-card detail-card--selected">
        <div className="detail-card__eyebrow">
          <MapPin size={14} strokeWidth={2} />
          <span className="panel-caption">Venue</span>
        </div>
        <h3>{selectedVenue.name}</h3>
        <p>{selectedVenue.address}</p>
        <p>{selectedVenue.description}</p>
      </div>
      <div className="workspace-button-row">
        <Link className="button-secondary" state={navState} to={`/venues/${selectedVenue.id}`}>
          Open venue
        </Link>
      </div>
      <EventTimeline
        contextLabel="Venue"
        emptyLabel="No sessions at this venue yet."
        meetings={selectedVenueMeetings}
        secondaryMeta="group"
        showGroupLabel
      />
    </div>
  ) : selectedGroup ? (
    <div className="stack-panel">
      {selectionPanelClose}
      <div className="detail-card detail-card--selected">
        <div className="detail-card__eyebrow">
          <Users size={14} strokeWidth={2} />
          <span className="panel-caption">Group</span>
        </div>
        <h3>{selectedGroup.name}</h3>
        <p>{selectedGroup.description}</p>
        <div className="mini-meta-row">
          <span className="mini-chip">{selectedGroup.visibility}</span>
          <span className="mini-chip">{selectedGroup.publicSessionCount} sessions</span>
        </div>
      </div>
      <div className="workspace-button-row">
        <Link className="button-secondary" state={navState} to={`/groups/${selectedGroup.id}`}>
          Open group
        </Link>
        {!selectedGroup.viewerRole && viewer ? (
          <button className="button-primary" onClick={() => membershipMutation.mutate(selectedGroup.id)} type="button">
            Request membership
          </button>
        ) : null}
      </div>
      <EventTimeline
        contextLabel="Group"
        emptyLabel="No sessions created by this group yet."
        meetings={selectedGroupMeetings}
        secondaryMeta="location"
        showGroupLabel={false}
      />
    </div>
  ) : (
    <EventTimeline
      contextLabel="Workspace"
      emptyLabel="No sessions available."
      heading="Upcoming sessions"
      meetings={meetings}
    />
  );

  const mobileFilterPanel = (
    <div className="filter-dropdown">
      <button className="workspace-ghost-button" onClick={() => setShowMobileFilters((current) => !current)} type="button">
        <Filter size={14} strokeWidth={2} />
        <span>Filter</span>
      </button>
      {showMobileFilters ? (
        <div className="filter-dropdown__panel">
          <div className="workspace-segmented workspace-segmented--column">
            <button className={itemMode === "sessions" ? "is-active" : ""} onClick={() => setItemMode("sessions")} type="button">
              <CalendarRange size={14} strokeWidth={2} />
              <span>Sessions</span>
            </button>
            <button className={itemMode === "groups" ? "is-active" : ""} onClick={() => setItemMode("groups")} type="button">
              <Users size={14} strokeWidth={2} />
              <span>Groups</span>
            </button>
            <button className={itemMode === "venues" ? "is-active" : ""} onClick={() => setItemMode("venues")} type="button">
              <MapPin size={14} strokeWidth={2} />
              <span>Venues</span>
            </button>
          </div>
          <div className="time-filter-group">
            {(["today", "tomorrow", "this-week", "next-weekend", "this-month", "custom"] as TimePreset[]).map((preset) => (
              <button
                className={timePreset === preset ? "is-active" : ""}
                key={preset}
                onClick={() => setTimePreset(preset)}
                type="button"
              >
                {preset.replace("-", " ")}
              </button>
            ))}
          </div>
          {timePreset === "custom" ? (
            <div className="custom-range-grid">
              <label className="field-stack">
                <span className="field-label">From</span>
                <input className="field-input" onChange={(event) => setCustomStartAt(event.target.value)} type="datetime-local" value={customStartAt} />
              </label>
              <label className="field-stack">
                <span className="field-label">To</span>
                <input className="field-input" onChange={(event) => setCustomEndAt(event.target.value)} type="datetime-local" value={customEndAt} />
              </label>
            </div>
          ) : null}
          <FilterCheckbox
            checked={bounds.pricing !== "paid"}
            label="Free"
            onChange={(checked) =>
              setBounds((current) => ({
                ...current,
                pricing: checked ? (current.pricing === "paid" ? "all" : current.pricing) : "paid",
              }))
            }
          />
          <FilterCheckbox
            checked={bounds.pricing !== "free"}
            label="Paid"
            onChange={(checked) =>
              setBounds((current) => ({
                ...current,
                pricing: checked ? (current.pricing === "free" ? "all" : current.pricing) : "free",
              }))
            }
          />
          <FilterCheckbox
            checked={bounds.openOnly}
            label="Free spots only"
            onChange={(checked) => setBounds((current) => ({ ...current, openOnly: checked }))}
          />
        </div>
      ) : null}
    </div>
  );

  const mobileDisplaySwitch = (
    <div className="workspace-segmented workspace-segmented--floating">
      <button className={displayMode === "map" ? "is-active" : ""} onClick={() => setDisplayMode("map")} type="button">
        <MapIcon size={14} strokeWidth={2} />
        <span>Map</span>
      </button>
      <button className={displayMode === "list" ? "is-active" : ""} onClick={() => setDisplayMode("list")} type="button">
        <List size={14} strokeWidth={2} />
        <span>List</span>
      </button>
    </div>
  );

  const listContent =
    itemMode === "sessions" ? (
      <EventTimeline
        contextLabel="Workspace"
        emptyLabel="No sessions match the current filters."
        meetings={meetings}
        onSelectMeeting={(meeting) => {
          setSelectedMeeting(meeting);
          setSelectedMeetingCluster(null);
          setSelectedVenue(null);
          setSelectedGroup(null);
        }}
      />
    ) : (
      <div className="stack-list stack-list--compact">
        {itemMode === "venues"
          ? venues.map((venue) => (
              <button
                className={`browse-listing ${selectedVenue?.id === venue.id ? "is-selected" : ""}`}
                key={venue.id}
                onClick={() => {
                  setSelectedVenue(venue);
                  setSelectedMeeting(null);
                  setSelectedMeetingCluster(null);
                  setSelectedGroup(null);
                }}
                type="button"
              >
                <div className="browse-listing__row">
                  <div>
                    <strong className="browse-listing__title">{venue.name}</strong>
                    <p className="browse-listing__meta">{venue.address}</p>
                  </div>
                  <span className="badge-outline">{venue.pricing}</span>
                </div>
                <p className="browse-listing__copy">{venue.description}</p>
              </button>
            ))
          : <>
              {viewer && memberGroups.length > 0 ? <p className="list-separator list-separator--plain">Your groups</p> : null}
              {viewer
                ? memberGroups.map((group) => (
                    <button
                      className={`browse-listing ${selectedGroup?.id === group.id ? "is-selected" : ""}`}
                      key={group.id}
                      onClick={() => {
                        setSelectedGroup(group);
                        setSelectedMeeting(null);
                        setSelectedMeetingCluster(null);
                        setSelectedVenue(null);
                      }}
                      type="button"
                    >
                      <div className="browse-listing__row">
                        <div>
                          <strong className="browse-listing__title">{group.name}</strong>
                          <p className="browse-listing__meta">{group.description}</p>
                        </div>
              <div className="compact-badges">
                <span className="badge">{group.viewerRole}</span>
                <span className="badge-outline">{group.visibility}</span>
                <span className="badge-outline">{group.publicSessionCount} sessions</span>
              </div>
                      </div>
                    </button>
                  ))
                : null}
              {viewer && memberGroups.length > 0 && publicGroups.length > 0 ? <div className="list-divider" /> : null}
              <p className="list-separator list-separator--plain">Public groups</p>
              {publicGroups.map((group) => (
                <button
                  className={`browse-listing ${selectedGroup?.id === group.id ? "is-selected" : ""}`}
                  key={group.id}
                  onClick={() => {
                    setSelectedGroup(group);
                    setSelectedMeeting(null);
                    setSelectedMeetingCluster(null);
                    setSelectedVenue(null);
                  }}
                  type="button"
                >
                  <div className="browse-listing__row">
                    <div>
                      <strong className="browse-listing__title">{group.name}</strong>
                      <p className="browse-listing__meta">{group.description}</p>
                    </div>
                    <div className="compact-badges">
                      <span className="badge-outline">{group.visibility}</span>
                      <span className="badge">{group.publicSessionCount} sessions</span>
                    </div>
                  </div>
                </button>
              ))}
            </>}
      </div>
    );

  return (
    <WorkspaceShell
      center={
        displayMode === "map" ? (
          <div className="workspace-map-center">
            <div className="map-overlay-controls">
              {mobileFilterPanel}
              {mobileDisplaySwitch}
            </div>
            <MapView
              groupPins={groupPins}
              meetings={meetings}
              mode={itemMode}
              onBackgroundClick={handleMapBackgroundClick}
              onBoundsChange={(mapBounds) =>
                setBounds((current) => ({
                  ...current,
                  ...mapBounds,
                }))
              }
              onGroupSelect={(group) => {
                setSelectedGroup(group);
                setSelectedMeeting(null);
                setSelectedMeetingCluster(null);
                setSelectedVenue(null);
                setShowMobileFilters(false);
              }}
              onMeetingClusterSelect={(cluster) => {
                setSelectedMeetingCluster(cluster);
                setSelectedMeeting(null);
                setSelectedGroup(null);
                setSelectedVenue(null);
                setShowMobileFilters(false);
              }}
              onMeetingSelect={(meeting) => {
                setSelectedMeeting(meeting);
                setSelectedMeetingCluster(null);
                setSelectedGroup(null);
                setSelectedVenue(null);
                setShowMobileFilters(false);
              }}
              onVenueSelect={(venue) => {
                setSelectedVenue(venue);
                setSelectedMeeting(null);
                setSelectedMeetingCluster(null);
                setSelectedGroup(null);
                setShowMobileFilters(false);
              }}
              selectedKey={selectedMeetingCluster?.lookupKey ?? selectedMeeting?.id ?? selectedVenue?.id ?? selectedGroup?.id}
              theme={theme}
              venueMeetingsById={venueMeetingsById}
              venues={venues}
            />
            {hasSelection ? (
              <aside className="mobile-details-drawer is-open">
                <div className="mobile-details-drawer__header">
                  <span className="panel-caption">Details</span>
                  <button
                    className="button-secondary button-inline"
                    onClick={clearSelection}
                    type="button"
                  >
                    Close
                  </button>
                </div>
                <div className="mobile-details-drawer__body">{selectionPanel}</div>
              </aside>
            ) : null}
          </div>
        ) : (
          <div className="workspace-list-center">
            <div className="map-overlay-controls">
              {mobileFilterPanel}
              {mobileDisplaySwitch}
            </div>
            <div className="workspace-list-heading">
              <p className="eyebrow">Browse</p>
              <h2 className="section-title typewriter-title">{listHeading}</h2>
            </div>
            {listContent}
            {hasSelection ? (
              <aside className="mobile-details-drawer is-open">
                <div className="mobile-details-drawer__header">
                  <span className="panel-caption">Details</span>
                  <button
                    className="button-secondary button-inline"
                    onClick={clearSelection}
                    type="button"
                  >
                    Close
                  </button>
                </div>
                <div className="mobile-details-drawer__body">{selectionPanel}</div>
              </aside>
            ) : null}
          </div>
        )
      }
      left={
        <div className="stack-panel">
          <div className="workspace-segmented workspace-segmented--column">
            <button className={displayMode === "map" ? "is-active" : ""} onClick={() => setDisplayMode("map")} type="button">
              <MapIcon size={14} strokeWidth={2} />
              <span>Map</span>
            </button>
            <button className={displayMode === "list" ? "is-active" : ""} onClick={() => setDisplayMode("list")} type="button">
              <List size={14} strokeWidth={2} />
              <span>List</span>
            </button>
          </div>

          <div className="workspace-segmented workspace-segmented--column">
            <button className={itemMode === "venues" ? "is-active" : ""} onClick={() => setItemMode("venues")} type="button">
              <MapPin size={14} strokeWidth={2} />
              <span>Venues</span>
            </button>
            <button className={itemMode === "groups" ? "is-active" : ""} onClick={() => setItemMode("groups")} type="button">
              <Users size={14} strokeWidth={2} />
              <span>Groups</span>
            </button>
            <button className={itemMode === "sessions" ? "is-active" : ""} onClick={() => setItemMode("sessions")} type="button">
              <CalendarRange size={14} strokeWidth={2} />
              <span>Sessions</span>
            </button>
          </div>

          <div className="stack-panel">
            <p className="panel-caption">Filters</p>
            <div className="time-filter-group">
              {(["today", "tomorrow", "this-week", "next-weekend", "this-month", "custom"] as TimePreset[]).map((preset) => (
                <button
                  className={timePreset === preset ? "is-active" : ""}
                  key={preset}
                  onClick={() => setTimePreset(preset)}
                  type="button"
                >
                  {preset.replace("-", " ")}
                </button>
              ))}
            </div>
            {timePreset === "custom" ? (
              <div className="custom-range-grid">
                <label className="field-stack">
                  <span className="field-label">From</span>
                  <input className="field-input" onChange={(event) => setCustomStartAt(event.target.value)} type="datetime-local" value={customStartAt} />
                </label>
                <label className="field-stack">
                  <span className="field-label">To</span>
                  <input className="field-input" onChange={(event) => setCustomEndAt(event.target.value)} type="datetime-local" value={customEndAt} />
                </label>
              </div>
            ) : null}
            <FilterCheckbox
              checked={bounds.pricing !== "paid"}
              label="Free"
              onChange={(checked) =>
                setBounds((current) => ({
                  ...current,
                  pricing: checked ? (current.pricing === "paid" ? "all" : current.pricing) : "paid",
                }))
              }
            />
            <FilterCheckbox
              checked={bounds.pricing !== "free"}
              label="Paid"
              onChange={(checked) =>
                setBounds((current) => ({
                  ...current,
                  pricing: checked ? (current.pricing === "free" ? "all" : current.pricing) : "free",
                }))
              }
            />
            <FilterCheckbox
              checked={bounds.openOnly}
              label="Free spots only"
              onChange={(checked) => setBounds((current) => ({ ...current, openOnly: checked }))}
            />
          </div>

          <div className="stack-panel">
            <p className="panel-caption">Your groups</p>
            {viewer ? (
              memberGroups.map((group) => (
                <Link className="mini-link" key={group.id} state={navState} to={`/groups/${group.id}`}>
                  {group.name} · {group.visibility}
                </Link>
              ))
            ) : (
              <p className="muted-copy">Sign in to manage private groups and attend sessions.</p>
            )}
          </div>
        </div>
      }
      leftHeader={undefined}
      mobileCollapsePanels
      onLogOut={onLogOut}
      right={selectionPanel}
      rightHeader={undefined}
      theme={theme}
      title={selectedTitle}
      toggleTheme={toggleTheme}
      topCenter={null}
      viewer={viewer}
    />
  );
}
