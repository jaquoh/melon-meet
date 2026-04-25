import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CalendarRange,
  Compass,
  Edit3,
  ExternalLink,
  Filter,
  List,
  Map as MapIcon,
  MapPin,
  MessageSquare,
  Shield,
  User,
  Users,
  X,
} from "lucide-react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { GroupSummary, MeetingSummary, VenueSummary, ViewerSummary } from "../../../../packages/shared/src";
import type { ThemeMode } from "../App";
import { CopyTextButton } from "../components/CopyTextButton";
import { EventTimeline } from "../components/EventTimeline";
import { FilterCheckbox } from "../components/FilterCheckbox";
import { GroupForm } from "../components/GroupForm";
import { MapView } from "../components/MapView";
import { MeetingForm } from "../components/MeetingForm";
import { PostBoard } from "../components/PostBoard";
import { ProfileForm } from "../components/ProfileForm";
import type { ProfileFormValues } from "../components/ProfileForm";
import { WorkspaceShell } from "../components/WorkspaceShell";
import {
  claimMeeting,
  createGroupPost,
  createMeeting,
  createMeetingPost,
  createMembershipRequest,
  getGroup,
  getGroups,
  getMap,
  getMeeting,
  getProfile,
  getVenue,
  updateProfile,
  updateGroup,
  updateMeeting,
  unclaimMeeting,
} from "../lib/api";
import { formatDateTimeWithWeekdayShort } from "../lib/format";
import { createNavigationState } from "../lib/navigation";
import { queryClient } from "../lib/query-client";

type DisplayMode = "list" | "map";
type ItemMode = "groups" | "sessions" | "venues";
type TimePreset = "all-sessions" | "custom" | "next-week" | "this-month" | "this-week" | "today" | "tomorrow";
type EditingTarget = null | { kind: "group" } | { kind: "meeting"; mode: "series" | "single" };
type FullscreenImageTarget = null | {
  imageUrl: string;
  quote: string;
  title: string;
};

interface DiscoveryWorkspaceState {
  bounds: DiscoveryBounds;
  customEndAt: string;
  customStartAt: string;
  displayMode: DisplayMode;
  itemMode: ItemMode;
  selectedGroupId?: string | null;
  selectedMeetingClusterMeetingIds?: string[];
  selectedMeetingClusterTitle?: string | null;
  selectedMeetingId?: string | null;
  selectedVenueId?: string | null;
  showMobileFilters: boolean;
  timePreset: TimePreset;
}

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

const MAP_DATA_BOUNDS = {
  east: 180,
  north: 90,
  south: -90,
  west: -180,
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

function formatPlayingLevelTag(level: string | null | undefined) {
  const trimmed = level?.trim();
  return `LVL ${trimmed && trimmed.length > 0 ? trimmed : "?"}`;
}

function timePresetLabel(preset: TimePreset) {
  if (preset === "all-sessions") return "All sessions";
  if (preset === "next-week") return "Next week";
  if (preset === "this-week") return "This week";
  if (preset === "this-month") return "This month";
  return preset.charAt(0).toUpperCase() + preset.slice(1).replace("-", " ");
}

function windowForPreset(preset: TimePreset, customStartAt: string, customEndAt: string) {
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === "all-sessions") {
    return { endAt: undefined, startAt: undefined };
  }
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
  if (preset === "next-week") {
    const nextWeekStart = new Date(dayStart.getTime() + 7 * 86400000);
    const nextWeekEnd = new Date(dayStart.getTime() + 14 * 86400000 - 1);
    return { endAt: toIso(nextWeekEnd), startAt: toIso(nextWeekStart) };
  }
  return {
    endAt: customEndAt ? new Date(customEndAt).toISOString() : undefined,
    startAt: customStartAt ? new Date(customStartAt).toISOString() : undefined,
  };
}

function workspaceRouteKind(pathname: string) {
  if (pathname.startsWith("/sessions/")) return "session";
  if (pathname.startsWith("/groups/")) return "group";
  if (pathname.startsWith("/profile/")) return "profile";
  if (pathname.startsWith("/venues/")) return "venue";
  return null;
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
  const navigate = useNavigate();
  const { groupId: routeGroupId, meetingId: routeMeetingId, profileId: routeProfileId, venueId: routeVenueId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const locationState =
    location.state && typeof location.state === "object"
      ? (location.state as { discoveryWorkspace?: DiscoveryWorkspaceState; previousWorkspacePath?: string; workspaceReturnStack?: string[] })
      : {};
  const workspaceState = locationState.discoveryWorkspace;
  const workspaceReturnStack = Array.isArray(locationState.workspaceReturnStack)
    ? locationState.workspaceReturnStack
    : typeof locationState.previousWorkspacePath === "string"
      ? [locationState.previousWorkspacePath]
      : [];
  const defaultCustomStartAt = formatDateInput(new Date());
  const defaultCustomEndAt = formatDateInput(new Date(Date.now() + 2 * 60 * 60 * 1000));
  const [displayMode, setDisplayMode] = useState<DisplayMode>(workspaceState?.displayMode ?? initialDisplayMode);
  const [itemMode, setItemMode] = useState<ItemMode>(workspaceState?.itemMode ?? initialItemMode);
  const [bounds, setBounds] = useState<DiscoveryBounds>(workspaceState?.bounds ?? INITIAL_BOUNDS);
  const [timePreset, setTimePreset] = useState<TimePreset>(workspaceState?.timePreset ?? "all-sessions");
  const [customStartAt, setCustomStartAt] = useState(workspaceState?.customStartAt ?? defaultCustomStartAt);
  const [customEndAt, setCustomEndAt] = useState(workspaceState?.customEndAt ?? defaultCustomEndAt);
  const [showMobileFilters, setShowMobileFilters] = useState(workspaceState?.showMobileFilters ?? false);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingSummary | null>(null);
  const [selectedMeetingCluster, setSelectedMeetingCluster] = useState<{
    lookupKey: string;
    meetings: MeetingSummary[];
    title: string;
  } | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<VenueSummary | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<GroupSummary | null>(null);
  const [editingTarget, setEditingTarget] = useState<EditingTarget>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState<ProfileFormValues | null>(null);
  const [mapSelectionRevision, setMapSelectionRevision] = useState(0);
  const [isClearingSelection, setIsClearingSelection] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<FullscreenImageTarget>(null);
  const filterDropdownRef = useRef<HTMLDivElement | null>(null);
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const [pendingSelectionState, setPendingSelectionState] = useState(() =>
    workspaceState
      ? {
          selectedGroupId: workspaceState.selectedGroupId ?? null,
          selectedMeetingClusterMeetingIds: workspaceState.selectedMeetingClusterMeetingIds ?? [],
          selectedMeetingClusterTitle: workspaceState.selectedMeetingClusterTitle ?? null,
          selectedMeetingId: workspaceState.selectedMeetingId ?? null,
          selectedVenueId: workspaceState.selectedVenueId ?? null,
        }
      : null,
  );
  const timeWindow = useMemo(
    () => windowForPreset(timePreset, customStartAt, customEndAt),
    [customEndAt, customStartAt, timePreset],
  );

  const mapQuery = useQuery({
    queryFn: () =>
      getMap({
        east: MAP_DATA_BOUNDS.east,
        endAt: itemMode !== "venues" ? timeWindow.endAt : undefined,
        north: MAP_DATA_BOUNDS.north,
        openOnly: bounds.openOnly,
        pricing: bounds.pricing,
        south: MAP_DATA_BOUNDS.south,
        startAt: itemMode !== "venues" ? timeWindow.startAt : undefined,
        west: MAP_DATA_BOUNDS.west,
      }),
    placeholderData: (previousData) => previousData,
    queryKey: [
      "map",
      itemMode,
      bounds.openOnly,
      bounds.pricing,
      itemMode !== "venues" ? timeWindow.endAt : null,
      itemMode !== "venues" ? timeWindow.startAt : null,
    ],
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
      if (selectedMeetingId) {
        await queryClient.invalidateQueries({ queryKey: ["meeting", selectedMeetingId] });
      }
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
  const selectedVenueIdFromQuery = searchParams.get("venue");

  function clearVenueQueryParam() {
    if (!searchParams.has("venue")) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.delete("venue");
    setSearchParams(next, { replace: true });
  }

  function buildWorkspaceState(
    overrides: Partial<DiscoveryWorkspaceState & { selectedMeetingCluster?: typeof selectedMeetingCluster }> = {},
  ): DiscoveryWorkspaceState {
    const hasOverride = (key: keyof DiscoveryWorkspaceState | "selectedMeetingCluster") =>
      Object.prototype.hasOwnProperty.call(overrides, key);
    const cluster = hasOverride("selectedMeetingCluster") ? overrides.selectedMeetingCluster : selectedMeetingCluster;
    return {
      bounds: hasOverride("bounds") ? overrides.bounds ?? bounds : bounds,
      customEndAt: hasOverride("customEndAt") ? overrides.customEndAt ?? customEndAt : customEndAt,
      customStartAt: hasOverride("customStartAt") ? overrides.customStartAt ?? customStartAt : customStartAt,
      displayMode: hasOverride("displayMode") ? overrides.displayMode ?? displayMode : displayMode,
      itemMode: hasOverride("itemMode") ? overrides.itemMode ?? itemMode : itemMode,
      selectedGroupId: hasOverride("selectedGroupId") ? overrides.selectedGroupId ?? null : routeGroupId ?? selectedGroup?.id ?? null,
      selectedMeetingClusterMeetingIds: hasOverride("selectedMeetingClusterMeetingIds")
        ? overrides.selectedMeetingClusterMeetingIds ?? []
        : cluster?.meetings.map((meeting) => meeting.id) ?? [],
      selectedMeetingClusterTitle: hasOverride("selectedMeetingClusterTitle")
        ? overrides.selectedMeetingClusterTitle ?? null
        : cluster?.title ?? null,
      selectedMeetingId: hasOverride("selectedMeetingId")
        ? overrides.selectedMeetingId ?? null
        : routeMeetingId ?? selectedMeeting?.id ?? null,
      selectedVenueId: hasOverride("selectedVenueId") ? overrides.selectedVenueId ?? null : routeVenueId ?? selectedVenue?.id ?? null,
      showMobileFilters: hasOverride("showMobileFilters") ? Boolean(overrides.showMobileFilters) : showMobileFilters,
      timePreset: hasOverride("timePreset") ? overrides.timePreset ?? timePreset : timePreset,
    };
  }

  function workspaceSearchWithoutLegacyVenue() {
    const next = new URLSearchParams(searchParams);
    next.delete("venue");
    const search = next.toString();
    return search ? `?${search}` : "";
  }

  function normalizeWorkspacePath(
    overrides: Partial<DiscoveryWorkspaceState & { selectedMeetingCluster?: typeof selectedMeetingCluster }> = {},
  ) {
    navigate(
      {
        pathname: location.pathname,
        search: workspaceSearchWithoutLegacyVenue(),
      },
      {
        replace: true,
        state: {
          ...locationState,
          discoveryWorkspace: buildWorkspaceState(overrides),
        },
      },
    );
  }

  function workspaceRouteState(
    overrides: Partial<DiscoveryWorkspaceState & { selectedMeetingCluster?: typeof selectedMeetingCluster }> = {},
    returnStack = workspaceReturnStack,
  ) {
    return {
      ...locationState,
      discoveryWorkspace: buildWorkspaceState(overrides),
      previousWorkspacePath: returnStack[returnStack.length - 1],
      workspaceReturnStack: returnStack,
    };
  }

  function returnStackForDetailNavigation() {
    if (!workspaceRouteKind(location.pathname)) {
      return workspaceReturnStack;
    }
    const lastPath = workspaceReturnStack[workspaceReturnStack.length - 1];
    return lastPath === location.pathname ? workspaceReturnStack : [...workspaceReturnStack, location.pathname];
  }

  function detailNavigationState(
    overrides: Partial<DiscoveryWorkspaceState & { selectedMeetingCluster?: typeof selectedMeetingCluster }> = {},
  ) {
    return workspaceRouteState(overrides, returnStackForDetailNavigation());
  }

  function navigateToWorkspacePath(
    pathname: string,
    overrides: Partial<DiscoveryWorkspaceState & { selectedMeetingCluster?: typeof selectedMeetingCluster }> = {},
  ) {
    navigate(
      {
        pathname,
        search: workspaceSearchWithoutLegacyVenue(),
      },
      {
        state: workspaceRouteState(overrides, workspaceRouteKind(pathname) ? returnStackForDetailNavigation() : workspaceReturnStack),
      },
    );
  }

  function navigateToMapSelectionPath(
    pathname: string,
    overrides: Partial<DiscoveryWorkspaceState & { selectedMeetingCluster?: typeof selectedMeetingCluster }> = {},
  ) {
    navigate(
      {
        pathname,
        search: workspaceSearchWithoutLegacyVenue(),
      },
      {
        replace: true,
        state: workspaceRouteState(overrides, []),
      },
    );
  }

  function headerProfileLinkState() {
    const currentPath = location.pathname;
    const nextReturnStack = workspaceRouteKind(currentPath)
      ? returnStackForDetailNavigation()
      : workspaceReturnStack[workspaceReturnStack.length - 1] === currentPath
        ? workspaceReturnStack
        : [...workspaceReturnStack, currentPath];
    return workspaceRouteState({}, nextReturnStack);
  }

  function createProfileDraft(profile: ViewerSummary): ProfileFormValues {
    return {
      avatarUrl: profile.avatarUrl ?? "",
      bio: profile.bio,
      displayName: profile.displayName,
      homeArea: profile.homeArea,
      isProfilePublic: profile.isProfilePublic,
      playingLevel: profile.playingLevel ?? "",
      showEmailPublicly: profile.showEmailPublicly,
    };
  }

  function selectMeeting(meeting: MeetingSummary) {
    setIsClearingSelection(false);
    navigateToWorkspacePath(`/sessions/${meeting.id}`, {
      itemMode: "sessions",
      selectedGroupId: null,
      selectedMeetingClusterMeetingIds: [],
      selectedMeetingClusterTitle: null,
      selectedMeetingId: meeting.id,
      selectedVenueId: null,
      showMobileFilters: false,
    });
    setItemMode("sessions");
    setSelectedMeeting(meeting);
    setSelectedMeetingCluster(null);
    setSelectedVenue(null);
    setSelectedGroup(null);
    setEditingTarget(null);
    setEditingProfile(false);
    setShowMobileFilters(false);
  }

  function selectMeetingFromMap(meeting: MeetingSummary) {
    setIsClearingSelection(false);
    navigateToMapSelectionPath(`/sessions/${meeting.id}`, {
      selectedGroupId: null,
      selectedMeetingClusterMeetingIds: [],
      selectedMeetingClusterTitle: null,
      selectedMeetingId: meeting.id,
      selectedVenueId: null,
      showMobileFilters: false,
    });
    setSelectedMeeting(meeting);
    setSelectedMeetingCluster(null);
    setSelectedVenue(null);
    setSelectedGroup(null);
    setEditingTarget(null);
    setEditingProfile(false);
    setShowMobileFilters(false);
  }

  function selectVenue(venue: VenueSummary) {
    setIsClearingSelection(false);
    navigateToWorkspacePath(`/venues/${venue.id}`, {
      itemMode: "venues",
      selectedGroupId: null,
      selectedMeetingClusterMeetingIds: [],
      selectedMeetingClusterTitle: null,
      selectedMeetingId: null,
      selectedVenueId: venue.id,
      showMobileFilters: false,
    });
    setItemMode("venues");
    setSelectedVenue(venue);
    setSelectedMeeting(null);
    setSelectedMeetingCluster(null);
    setSelectedGroup(null);
    setEditingTarget(null);
    setEditingProfile(false);
    setShowMobileFilters(false);
  }

  function selectVenueFromMap(venue: VenueSummary) {
    setIsClearingSelection(false);
    navigateToMapSelectionPath(`/venues/${venue.id}`, {
      itemMode: "venues",
      selectedGroupId: null,
      selectedMeetingClusterMeetingIds: [],
      selectedMeetingClusterTitle: null,
      selectedMeetingId: null,
      selectedVenueId: venue.id,
      showMobileFilters: false,
    });
    setSelectedVenue(venue);
    setSelectedMeeting(null);
    setSelectedMeetingCluster(null);
    setSelectedGroup(null);
    setEditingTarget(null);
    setEditingProfile(false);
    setShowMobileFilters(false);
  }

  function selectGroup(group: GroupSummary) {
    setIsClearingSelection(false);
    navigateToWorkspacePath(`/groups/${group.id}`, {
      itemMode: "groups",
      selectedGroupId: group.id,
      selectedMeetingClusterMeetingIds: [],
      selectedMeetingClusterTitle: null,
      selectedMeetingId: null,
      selectedVenueId: null,
      showMobileFilters: false,
    });
    setItemMode("groups");
    setSelectedGroup(group);
    setSelectedMeeting(null);
    setSelectedMeetingCluster(null);
    setSelectedVenue(null);
    setEditingTarget(null);
    setEditingProfile(false);
    setShowMobileFilters(false);
  }

  function selectGroupFromMap(group: GroupSummary) {
    setIsClearingSelection(false);
    navigateToMapSelectionPath(`/groups/${group.id}`, {
      itemMode: "groups",
      selectedGroupId: group.id,
      selectedMeetingClusterMeetingIds: [],
      selectedMeetingClusterTitle: null,
      selectedMeetingId: null,
      selectedVenueId: null,
      showMobileFilters: false,
    });
    setSelectedGroup(group);
    setSelectedMeeting(null);
    setSelectedMeetingCluster(null);
    setSelectedVenue(null);
    setEditingTarget(null);
    setEditingProfile(false);
    setShowMobileFilters(false);
  }

  function selectMeetingCluster(cluster: { lookupKey: string; meetings: MeetingSummary[]; title: string }) {
    setIsClearingSelection(false);
    navigateToWorkspacePath("/discover", {
      selectedGroupId: null,
      selectedMeetingCluster: cluster,
      selectedMeetingClusterMeetingIds: cluster.meetings.map((meeting) => meeting.id),
      selectedMeetingClusterTitle: cluster.title,
      selectedMeetingId: null,
      selectedVenueId: null,
      showMobileFilters: false,
    });
    setSelectedMeetingCluster(cluster);
    setSelectedMeeting(null);
    setSelectedGroup(null);
    setSelectedVenue(null);
    setEditingTarget(null);
    setEditingProfile(false);
    setShowMobileFilters(false);
  }

  function selectMeetingClusterFromMap(cluster: { lookupKey: string; meetings: MeetingSummary[]; title: string }) {
    setIsClearingSelection(false);
    navigateToMapSelectionPath("/discover", {
      selectedGroupId: null,
      selectedMeetingCluster: cluster,
      selectedMeetingClusterMeetingIds: cluster.meetings.map((meeting) => meeting.id),
      selectedMeetingClusterTitle: cluster.title,
      selectedMeetingId: null,
      selectedVenueId: null,
      showMobileFilters: false,
    });
    setSelectedMeetingCluster(cluster);
    setSelectedMeeting(null);
    setSelectedGroup(null);
    setSelectedVenue(null);
    setEditingTarget(null);
    setEditingProfile(false);
    setShowMobileFilters(false);
  }

  function setItemModeSafely(nextMode: ItemMode) {
    normalizeWorkspacePath({ itemMode: nextMode });
    if (nextMode !== "venues") {
      clearVenueQueryParam();
    }
    setItemMode(nextMode);
  }

  useEffect(() => {
    const baseMode =
      location.pathname === "/groups" ? "groups" : location.pathname === "/sessions" ? "sessions" : location.pathname === "/venues" ? "venues" : null;
    if (!baseMode) {
      return;
    }

    const overrides = {
      displayMode: "list" as const,
      itemMode: baseMode,
      selectedGroupId: null,
      selectedMeetingClusterMeetingIds: [],
      selectedMeetingClusterTitle: null,
      selectedMeetingId: null,
      selectedVenueId: null,
      showMobileFilters: false,
    } satisfies Partial<DiscoveryWorkspaceState>;
    setDisplayMode("list");
    setItemMode(baseMode);
    setShowMobileFilters(false);
    navigate(
      {
        pathname: "/discover",
        search: workspaceSearchWithoutLegacyVenue(),
      },
      {
        replace: true,
        state: workspaceRouteState(overrides, []),
      },
    );
  }, [location.pathname]);

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
      groups
        .map((group) => {
          const filteredMeetings = groupMeetingsById[group.id] ?? [];
          const nextMeeting = filteredMeetings[0] ?? null;
          if (!nextMeeting) {
            return null;
          }
          return {
            filteredSessionCount: filteredMeetings.length,
            group,
            latitude: nextMeeting.latitude,
            longitude: nextMeeting.longitude,
            nextMeeting,
          };
        })
        .filter((value): value is NonNullable<typeof value> => Boolean(value)),
    [groupMeetingsById, groups],
  );

  useEffect(() => {
    if (!showMobileFilters) {
      return;
    }

    function handleDocumentPointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && filterDropdownRef.current?.contains(target)) {
        return;
      }
      setShowMobileFilters(false);
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown);
    return () => document.removeEventListener("pointerdown", handleDocumentPointerDown);
  }, [showMobileFilters]);

  useEffect(() => {
    if (!routeProfileId) {
      return;
    }
    setSelectedMeeting(null);
    setSelectedMeetingCluster(null);
    setSelectedVenue(null);
    setSelectedGroup(null);
    setEditingTarget(null);
    setEditingProfile(false);
    setProfileDraft(null);
  }, [routeProfileId]);

  useEffect(() => {
    if (isClearingSelection) {
      return;
    }
    if (routeMeetingId || routeVenueId || routeGroupId) {
      setDisplayMode(workspaceState?.displayMode ?? "map");
      setItemMode(workspaceState?.itemMode ?? (routeVenueId ? "venues" : routeGroupId ? "groups" : "sessions"));
    }
    if (routeProfileId) {
      return;
    }
    if (routeMeetingId) {
      setSelectedMeeting(meetings.find((meeting) => meeting.id === routeMeetingId) ?? null);
      setSelectedMeetingCluster(null);
      setSelectedVenue(null);
      setSelectedGroup(null);
      setEditingTarget(null);
      return;
    }
    if (routeVenueId) {
      setSelectedVenue(venues.find((venue) => venue.id === routeVenueId) ?? null);
      setSelectedMeeting(null);
      setSelectedMeetingCluster(null);
      setSelectedGroup(null);
      setEditingTarget(null);
      return;
    }
    if (routeGroupId) {
      setSelectedGroup(groups.find((group) => group.id === routeGroupId) ?? null);
      setSelectedMeeting(null);
      setSelectedMeetingCluster(null);
      setSelectedVenue(null);
      setEditingTarget(null);
    }
  }, [
    groups,
    isClearingSelection,
    meetings,
    routeGroupId,
    routeMeetingId,
    routeProfileId,
    routeVenueId,
    venues,
    workspaceState?.displayMode,
    workspaceState?.itemMode,
  ]);

  useEffect(() => {
    if (!routeGroupId && !routeMeetingId && !routeProfileId && !routeVenueId) {
      setIsClearingSelection(false);
    }
  }, [routeGroupId, routeMeetingId, routeProfileId, routeVenueId]);

  const selectedMeetingId = isClearingSelection ? selectedMeeting?.id ?? null : routeMeetingId ?? selectedMeeting?.id ?? null;
  const selectedVenueId = isClearingSelection ? selectedVenue?.id ?? null : routeVenueId ?? selectedVenue?.id ?? null;
  const selectedGroupId = isClearingSelection ? selectedGroup?.id ?? null : routeGroupId ?? selectedGroup?.id ?? null;
  const selectedProfileId = isClearingSelection ? null : routeProfileId ?? null;

  const selectedMeetingDetailQuery = useQuery({
    enabled: Boolean(selectedMeetingId),
    queryFn: () => getMeeting(selectedMeetingId as string),
    queryKey: ["meeting", selectedMeetingId],
  });

  const selectedVenueDetailQuery = useQuery({
    enabled: Boolean(selectedVenueId),
    queryFn: () => getVenue(selectedVenueId as string),
    queryKey: ["venue", selectedVenueId],
  });

  const selectedGroupDetailQuery = useQuery({
    enabled: Boolean(selectedGroupId),
    queryFn: () => getGroup(selectedGroupId as string),
    queryKey: ["group", selectedGroupId],
  });

  const selectedProfileDetailQuery = useQuery({
    enabled: Boolean(selectedProfileId),
    queryFn: () => getProfile(selectedProfileId as string),
    queryKey: ["profile", selectedProfileId],
  });

  const updateGroupMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => updateGroup(selectedGroupId as string, payload),
    onSuccess: async () => {
      setEditingTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["group", selectedGroupId] });
      await queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });

  const updateMeetingMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => updateMeeting(selectedMeetingId as string, payload),
    onSuccess: async () => {
      setEditingTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["meeting", selectedMeetingId] });
      await queryClient.invalidateQueries({ queryKey: ["map"] });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => updateProfile(selectedProfileId as string, payload),
    onSuccess: async () => {
      setEditingProfile(false);
      setProfileDraft(null);
      await queryClient.invalidateQueries({ queryKey: ["profile", selectedProfileId] });
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });

  const groupPostMutation = useMutation({
    mutationFn: (content: string) => createGroupPost(selectedGroupId as string, content),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["group", selectedGroupId] });
    },
  });

  const meetingPostMutation = useMutation({
    mutationFn: (content: string) => createMeetingPost(selectedMeetingId as string, content),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["meeting", selectedMeetingId] });
    },
  });

  useEffect(() => {
    if (!selectedVenueIdFromQuery) {
      return;
    }
    const venue = venues.find((entry) => entry.id === selectedVenueIdFromQuery) ?? null;
    if (!venue && venues.length > 0) {
      clearVenueQueryParam();
      return;
    }
    setDisplayMode("map");
    setItemMode("venues");
    setSelectedMeeting(null);
    setSelectedMeetingCluster(null);
    setSelectedGroup(null);
    setSelectedVenue(venue);
  }, [selectedVenueIdFromQuery, venues]);

  useEffect(() => {
    if (!pendingSelectionState || selectedVenueIdFromQuery) {
      return;
    }

    const clusterMeetings =
      pendingSelectionState.selectedMeetingClusterMeetingIds.length > 0
        ? meetings.filter((meeting) => pendingSelectionState.selectedMeetingClusterMeetingIds.includes(meeting.id))
        : [];

    if (clusterMeetings.length > 0) {
      setSelectedMeetingCluster({
        lookupKey: clusterMeetings.map((meeting) => meeting.id).sort().join(":"),
        meetings: clusterMeetings,
        title: pendingSelectionState.selectedMeetingClusterTitle ?? `${clusterMeetings.length} sessions`,
      });
      setPendingSelectionState(null);
      return;
    }

    if (pendingSelectionState.selectedMeetingId) {
      const meeting = meetings.find((entry) => entry.id === pendingSelectionState.selectedMeetingId);
      if (meeting) {
        setSelectedMeeting(meeting);
        setPendingSelectionState(null);
        return;
      }
    }

    if (pendingSelectionState.selectedVenueId) {
      const venue = venues.find((entry) => entry.id === pendingSelectionState.selectedVenueId);
      if (venue) {
        setSelectedVenue(venue);
        setPendingSelectionState(null);
        return;
      }
    }

    if (pendingSelectionState.selectedGroupId) {
      const group = groups.find((entry) => entry.id === pendingSelectionState.selectedGroupId);
      if (group) {
        setSelectedGroup(group);
        setPendingSelectionState(null);
        return;
      }
    }

    if (
      !pendingSelectionState.selectedMeetingId &&
      !pendingSelectionState.selectedVenueId &&
      !pendingSelectionState.selectedGroupId &&
      pendingSelectionState.selectedMeetingClusterMeetingIds.length === 0
    ) {
      setPendingSelectionState(null);
    }
  }, [groups, meetings, pendingSelectionState, selectedVenueIdFromQuery, venues]);

  const selectedMeetingDetail =
    selectedMeetingDetailQuery.data?.meeting.id === selectedMeetingId ? selectedMeetingDetailQuery.data.meeting : selectedMeeting;
  const selectedVenueDetail =
    selectedVenueDetailQuery.data?.venue.id === selectedVenueId ? selectedVenueDetailQuery.data.venue : selectedVenue;
  const selectedGroupDetail =
    selectedGroupDetailQuery.data?.group.id === selectedGroupId ? selectedGroupDetailQuery.data.group : selectedGroup;
  const selectedProfileDetail =
    selectedProfileDetailQuery.data?.profile ?? (selectedProfileId && viewer?.id === selectedProfileId ? viewer : null);
  const selectedProfileMemberships = selectedProfileDetailQuery.data?.memberships ?? [];
  const selectedProfileAttending = selectedProfileDetailQuery.data?.attending ?? [];
  const selectedProfileResponsible = selectedProfileDetailQuery.data?.responsible ?? [];
  const selectedMeetingClaims = selectedMeetingDetailQuery.data?.claims ?? [];
  const isOwnProfile = Boolean(selectedProfileId && viewer?.id === selectedProfileId);
  const createdSessionsHeading = isOwnProfile ? "Your created Sessions" : "Created Sessions";
  const activeProfileDraft = profileDraft ?? (selectedProfileDetail ? createProfileDraft(selectedProfileDetail) : null);
  const selectedTitle =
    selectedMeetingDetail?.title ??
    selectedMeetingCluster?.title ??
    selectedVenueDetail?.name ??
    selectedGroupDetail?.name ??
    selectedProfileDetail?.displayName ??
    "";
  const listHeading = itemMode === "groups" ? "Groups" : itemMode === "venues" ? "Venues" : "Sessions";
  const navState = createNavigationState(location, "Workspace");
  const selectedVenueMeetings =
    selectedVenueDetailQuery.data?.venue.id === selectedVenueId
      ? selectedVenueDetailQuery.data.meetings
      : selectedVenueId
        ? venueMeetingsById[selectedVenueId] ?? []
        : [];
  const selectedGroupMeetings =
    selectedGroupDetailQuery.data?.group.id === selectedGroupId
      ? selectedGroupDetailQuery.data.meetings
      : selectedGroupId
        ? groupMeetingsById[selectedGroupId] ?? []
        : [];
  const visibleSessionClusterKey =
    selectedMeetingDetail && itemMode === "sessions"
      ? (() => {
          const sameLocationMeetings = meetings.filter(
            (meeting) =>
              meeting.id !== selectedMeetingDetail.id &&
              meeting.latitude.toFixed(5) === selectedMeetingDetail.latitude.toFixed(5) &&
              meeting.longitude.toFixed(5) === selectedMeetingDetail.longitude.toFixed(5),
          );
          return sameLocationMeetings.length > 0
            ? `session-cluster:${selectedMeetingDetail.latitude}:${selectedMeetingDetail.longitude}`
            : null;
        })()
      : null;
  const selectedMapKey =
    isClearingSelection
      ? null
      : selectedMeetingCluster?.lookupKey ??
        visibleSessionClusterKey ??
        selectedMeetingId ??
        selectedVenueId ??
        selectedGroupId;
  const selectedMapLocation = selectedMeetingDetail
    ? {
        id: visibleSessionClusterKey ?? `meeting:${selectedMeetingDetail.id}`,
        latitude: selectedMeetingDetail.latitude,
        longitude: selectedMeetingDetail.longitude,
      }
    : selectedVenueDetail
      ? {
          id: `venue:${selectedVenueDetail.id}`,
          latitude: selectedVenueDetail.latitude,
          longitude: selectedVenueDetail.longitude,
        }
      : selectedGroupDetail && selectedGroupMeetings[0]
        ? {
            id: `group:${selectedGroupDetail.id}`,
            latitude: selectedGroupMeetings[0].latitude,
            longitude: selectedGroupMeetings[0].longitude,
          }
        : selectedGroup && groupMeetingsById[selectedGroup.id]?.[0]
          ? {
              id: `group:${selectedGroup.id}`,
              latitude: groupMeetingsById[selectedGroup.id][0].latitude,
              longitude: groupMeetingsById[selectedGroup.id][0].longitude,
            }
          : null;
  const hasSelection = Boolean(selectedMeetingId || selectedMeetingCluster || selectedVenueId || selectedGroupId || selectedProfileId);
  const showUpcomingSessions = displayMode === "map" || itemMode !== "sessions";
  const returnPath = workspaceReturnStack[workspaceReturnStack.length - 1];
  const returnRouteKind = returnPath ? workspaceRouteKind(returnPath) : null;
  const emptySelectionState = {
    selectedGroupId: null,
    selectedMeetingClusterMeetingIds: [],
    selectedMeetingClusterTitle: null,
    selectedMeetingId: null,
    selectedVenueId: null,
  } satisfies Partial<DiscoveryWorkspaceState>;
  const clearSelection = () => {
    setIsClearingSelection(true);
    setMapSelectionRevision((current) => current + 1);
    if (!routeGroupId && !routeMeetingId && !routeVenueId && !routeProfileId) {
      normalizeWorkspacePath(emptySelectionState);
    }
    setSelectedMeeting(null);
    setSelectedMeetingCluster(null);
    setSelectedVenue(null);
    setSelectedGroup(null);
    setEditingTarget(null);
    setEditingProfile(false);
    setProfileDraft(null);
    clearVenueQueryParam();
    if (!routeGroupId && !routeMeetingId && !routeVenueId && !routeProfileId) {
      setIsClearingSelection(false);
    }
  };

  const handleSelectionClose = () => {
    setIsClearingSelection(true);
    setMapSelectionRevision((current) => current + 1);
    if (routeGroupId || routeMeetingId || routeVenueId || routeProfileId) {
      setSelectedMeeting(null);
      setSelectedMeetingCluster(null);
      setSelectedVenue(null);
      setSelectedGroup(null);
      setEditingTarget(null);
      setEditingProfile(false);
      setProfileDraft(null);

      const goToPrevious =
        typeof returnPath === "string" &&
        (routeProfileId ||
          (routeMeetingId && (returnRouteKind === "group" || returnRouteKind === "venue")));

      if (goToPrevious) {
        if (
          typeof window !== "undefined" &&
          window.history.state &&
          typeof window.history.state.idx === "number" &&
          window.history.state.idx > 0
        ) {
          navigate(-1);
          return;
        }

        const nextReturnStack = workspaceReturnStack.slice(0, -1);
        navigate(
          {
            pathname: returnPath,
            search: workspaceSearchWithoutLegacyVenue(),
          },
          {
            replace: true,
            state: workspaceRouteState(emptySelectionState, nextReturnStack),
          },
        );
        return;
      }

      navigate(
        {
          pathname: "/discover",
          search: workspaceSearchWithoutLegacyVenue(),
        },
        {
          replace: true,
          state: workspaceRouteState(emptySelectionState, []),
        },
      );
      return;
    }

    clearSelection();
  };

  useEffect(() => {
    const selectors = [
      ".workspace-frame--unified .workspace-cell--right .workspace-panel__body",
      ".mobile-details-drawer__body",
    ];
    for (const selector of selectors) {
      document.querySelector<HTMLElement>(selector)?.scrollTo({ top: 0 });
    }
  }, [selectedGroupId, selectedMeetingCluster?.lookupKey, selectedMeetingId, selectedProfileId, selectedVenueId]);

  useEffect(() => {
    setFullscreenImage(null);
  }, [selectedGroupId, selectedMeetingId, selectedVenueId]);

  useEffect(() => {
    if (displayMode !== "list") {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      listScrollRef.current
        ?.querySelector<HTMLElement>('[data-active-list-item="true"]')
        ?.scrollIntoView({ block: "center", inline: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [displayMode, itemMode, selectedGroupId, selectedMeetingId, selectedVenueId]);

  const handleMapBackgroundClick = () => {
    setShowMobileFilters(false);
    handleSelectionClose();
  };

  const selectionHeaderActions = hasSelection ? (
    <div className="workspace-panel-header-actions">
      <button className="button-secondary workspace-panel-close-square" onClick={handleSelectionClose} type="button" aria-label="Clear selection">
        <X size={16} strokeWidth={2} />
      </button>
    </div>
  ) : null;

  function renderImagePane({
    imageUrl,
    quote,
    title,
  }: {
    imageUrl?: string | null;
    quote: string;
    title: string;
  }) {
    const normalizedImageUrl = imageUrl?.trim() || null;
    const className = `detail-hero__media info-panel__hero ${normalizedImageUrl ? "has-image" : ""}`.trim();

    if (!normalizedImageUrl) {
      return (
        <div className={className} key={`${title}:empty`}>
          <div className="detail-hero__fallback" aria-hidden="true" />
        </div>
      );
    }

    return (
      <button
        aria-label={`Open image for ${title}`}
        className={`${className} detail-hero__media--button`}
        key={`${title}:${normalizedImageUrl}`}
        onClick={() => setFullscreenImage({ imageUrl: normalizedImageUrl, quote, title })}
        type="button"
      >
        <img alt={title} className="detail-hero__image" src={normalizedImageUrl} />
        <div className="detail-hero__fallback" aria-hidden="true" />
      </button>
    );
  }

  async function handleMeetingSave(payload: Record<string, unknown>) {
    const { seriesDates, ...basePayload } = payload as Record<string, unknown> & {
      seriesDates?: Array<{ endsAt: string; startsAt: string }>;
    };
    const editingSeries = editingTarget?.kind === "meeting" && editingTarget.mode === "series";

    if (editingSeries) {
      await updateMeetingMutation.mutateAsync({
        ...basePayload,
        applyToSeries: true,
        seriesDates,
      });
      return;
    }

    if (!seriesDates || seriesDates.length === 0) {
      await updateMeetingMutation.mutateAsync(basePayload);
      return;
    }

    const sortedDates = [...seriesDates].sort(
      (left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
    );
    const [primary, ...rest] = sortedDates;
    if (!primary || !selectedMeetingDetail) {
      return;
    }

    await updateMeetingMutation.mutateAsync({
      ...basePayload,
      endsAt: primary.endsAt,
      startsAt: primary.startsAt,
    });

    for (const slot of rest) {
      await createMeeting({
        activityLabel: basePayload.activityLabel,
        capacity: basePayload.capacity,
        costPerPerson: basePayload.costPerPerson,
        description: basePayload.description,
        endsAt: slot.endsAt,
        groupId: selectedMeetingDetail.groupId,
        heroImageUrl: basePayload.heroImageUrl,
        latitude: basePayload.latitude,
        locationAddress: basePayload.locationAddress,
        locationName: basePayload.locationName,
        longitude: basePayload.longitude,
        pricing: basePayload.pricing,
        recurrence: { type: "once" },
        shortName: basePayload.shortName,
        startsAt: slot.startsAt,
        title: basePayload.title,
        venueId: basePayload.venueId,
      });
    }
    await queryClient.invalidateQueries({ queryKey: ["map"] });
  }

  const editPanel =
    editingTarget?.kind === "group" && selectedGroupDetail ? (
      <div className="workspace-edit-surface">
        <div className="screen-heading">
          <p className="eyebrow">Edit</p>
          <h2 className="screen-heading__title">Group</h2>
        </div>
        <GroupForm
          formId="workspace-group-edit-form"
          initialValues={{
            activityLabel: selectedGroupDetail.activityLabel,
            description: selectedGroupDetail.description,
            heroImageUrl: selectedGroupDetail.heroImageUrl,
            messengerUrl: selectedGroupDetail.messengerUrl,
            name: selectedGroupDetail.name,
            slug: selectedGroupDetail.slug,
            visibility: selectedGroupDetail.visibility,
          }}
          onSubmit={async (payload) => updateGroupMutation.mutateAsync(payload)}
        />
        <div className="editor-action-row">
          <div className="editor-action-row__right">
            <button className="button-secondary" onClick={() => setEditingTarget(null)} type="button">
              Cancel
            </button>
            <button className="button-primary" form="workspace-group-edit-form" type="submit">
              Save group
            </button>
          </div>
        </div>
      </div>
    ) : editingTarget?.kind === "meeting" && selectedMeetingDetail ? (
      <div className="workspace-edit-surface">
        <div className="screen-heading">
          <p className="eyebrow">Edit</p>
          <h2 className="screen-heading__title">{editingTarget.mode === "series" ? "Session Series" : "Session"}</h2>
        </div>
        <MeetingForm
          formId="workspace-meeting-edit-form"
          groups={groupsQuery.data?.groups ?? []}
          initialMeeting={selectedMeetingDetail}
          initialSeriesDates={(selectedMeetingDetailQuery.data?.seriesMeetings ?? []).map((entry) => ({
            endsAt: entry.endsAt,
            startsAt: entry.startsAt,
          }))}
          onSubmit={handleMeetingSave}
          seriesMode={editingTarget.mode === "series"}
        />
        <div className="editor-action-row">
          <div className="editor-action-row__right">
            <button className="button-secondary" onClick={() => setEditingTarget(null)} type="button">
              Cancel
            </button>
            <button className="button-primary" form="workspace-meeting-edit-form" type="submit">
              Save session
            </button>
          </div>
        </div>
      </div>
    ) : null;

  const selectionPanel = selectedProfileId ? (
    selectedProfileDetail ? (
      <div className="info-panel">
        <div className="info-panel__sticky-title">
          {selectionHeaderActions}
          <div className="detail-card__eyebrow">
            <Users size={14} strokeWidth={2} />
            <span className="panel-caption">Profile</span>
          </div>
          <h2 className="info-panel__title">{selectedProfileDetail.displayName}</h2>
          <div className="info-tags">
            <span className="mini-chip">{selectedProfileDetail.isProfilePublic ? "public" : "private"}</span>
            <span className="mini-chip">{formatPlayingLevelTag(selectedProfileDetail.playingLevel)}</span>
            {selectedProfileMemberships.length > 0 ? <span className="mini-chip">{selectedProfileMemberships.length} groups</span> : null}
            {selectedProfileAttending.length > 0 ? <span className="mini-chip">{selectedProfileAttending.length} attending</span> : null}
          </div>
        </div>
        <div className={`detail-hero__media info-panel__hero ${selectedProfileDetail.avatarUrl ? "has-image" : ""}`.trim()}>
          {selectedProfileDetail.avatarUrl ? (
            <img alt={selectedProfileDetail.displayName} className="detail-hero__image" src={selectedProfileDetail.avatarUrl} />
          ) : null}
          <div className="detail-hero__fallback profile-avatar-fallback" aria-hidden={Boolean(selectedProfileDetail.avatarUrl)}>
            <User size={48} strokeWidth={1.8} />
          </div>
        </div>
        {editingProfile && isOwnProfile ? (
          activeProfileDraft ? (
          <>
            <ProfileForm
              formId="workspace-profile-edit-form"
              onChange={setProfileDraft}
              onSubmit={async (payload) => updateProfileMutation.mutateAsync(payload)}
              profile={activeProfileDraft}
            />
            <div className="editor-action-row">
              <div className="editor-action-row__right">
                <button
                  className="button-secondary"
                  onClick={() => {
                    setEditingProfile(false);
                    setProfileDraft(null);
                  }}
                  type="button"
                >
                  Cancel
                </button>
                <button className="button-primary" form="workspace-profile-edit-form" type="submit">
                  Save profile
                </button>
              </div>
            </div>
          </>
          ) : null
        ) : (
          <>
            {selectedProfileDetailQuery.data?.profileIsPrivate && !isOwnProfile ? (
              <p className="muted-copy">This profile is private.</p>
            ) : (
              <>
                <p className="detail-quote detail-quote--hero">{selectedProfileDetail.bio || "No bio yet."}</p>
                <section className="info-grid">
                  {selectedProfileDetail.homeArea ? (
                    <div>
                      <span className="panel-caption">Home area</span>
                      <strong>{selectedProfileDetail.homeArea}</strong>
                    </div>
                  ) : null}
                  {selectedProfileDetail.email ? (
                    <div>
                      <span className="panel-caption">Email</span>
                      <strong>{selectedProfileDetail.email}</strong>
                    </div>
                  ) : null}
                </section>
                {selectedProfileMemberships.length > 0 ? (
                  <div className="stack-panel">
                    <p className="panel-caption">Groups</p>
                    <div className="subtle-action-row">
                      {selectedProfileMemberships.map((membership) => (
                        <Link
                          className="mini-link"
                          key={membership.id}
                          state={detailNavigationState({
                            itemMode: "groups",
                            selectedGroupId: membership.id,
                            selectedMeetingClusterMeetingIds: [],
                            selectedMeetingClusterTitle: null,
                            selectedMeetingId: null,
                            selectedVenueId: null,
                          })}
                          to={`/groups/${membership.id}`}
                        >
                          {membership.name} · {membership.role}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="subtle-action-row">
                  {isOwnProfile ? (
                    <button
                      className="button-secondary button-inline"
                      onClick={() => {
                        setProfileDraft(createProfileDraft(selectedProfileDetail));
                        setEditingProfile(true);
                      }}
                      type="button"
                    >
                      <Edit3 size={14} strokeWidth={2} />
                      Edit
                    </button>
                  ) : null}
                  {isOwnProfile ? (
                    <button className="button-danger button-inline" onClick={onLogOut} type="button">
                      Sign out
                    </button>
                  ) : null}
                </div>
                {selectedProfileAttending.length > 0 ? (
                  <EventTimeline
                    contextLabel="Profile"
                    emptyLabel="No upcoming sessions."
                    heading="Attending"
                    meetings={selectedProfileAttending}
                    onSelectMeeting={selectMeeting}
                    secondaryMeta="location"
                    showGroupLabel
                  />
                ) : null}
                {selectedProfileResponsible.length > 0 ? (
                  <EventTimeline
                    contextLabel="Profile"
                    emptyLabel="No hosted sessions."
                    heading={createdSessionsHeading}
                    meetings={selectedProfileResponsible}
                    onSelectMeeting={selectMeeting}
                    secondaryMeta="location"
                    showGroupLabel
                  />
                ) : null}
              </>
            )}
          </>
        )}
      </div>
    ) : selectedProfileDetailQuery.isLoading ? (
      <div className="info-panel info-panel--empty">
        <MessageSquare size={18} strokeWidth={2} />
        <h2 className="info-panel__title">Loading profile...</h2>
      </div>
    ) : (
      <div className="info-panel info-panel--empty">
        <MessageSquare size={18} strokeWidth={2} />
        <h2 className="info-panel__title">Profile not found.</h2>
      </div>
    )
  ) : selectedMeetingCluster ? (
    <div className="info-panel">
      <div className="info-panel__sticky-title">
        {selectionHeaderActions}
        <div className="detail-card__eyebrow">
          <CalendarRange size={14} strokeWidth={2} />
          <span className="panel-caption">Session cluster</span>
        </div>
        <h2 className="info-panel__title">{selectedMeetingCluster.title}</h2>
        <p className="muted-copy">{selectedMeetingCluster.meetings.length} sessions at this location</p>
      </div>
      <EventTimeline
        contextLabel="Workspace"
        emptyLabel="No sessions at this location."
        heading="Sessions at this location"
        meetings={selectedMeetingCluster.meetings}
        onSelectMeeting={selectMeeting}
      />
    </div>
  ) : selectedMeetingDetail ? (
    <div className="info-panel">
      <div className="info-panel__sticky-title">
        {selectionHeaderActions}
        <div className="detail-card__eyebrow">
          <CalendarRange size={14} strokeWidth={2} />
          <span className="panel-caption">Session</span>
        </div>
        <h2 className={`info-panel__title ${selectedMeetingDetail.status === "cancelled" ? "session-title--cancelled" : ""}`.trim()}>
          {selectedMeetingDetail.title}
        </h2>
        <div className="info-tags">
          {selectedMeetingDetail.status === "cancelled" ? <span className="badge-cancelled">Cancelled</span> : null}
          <span className="mini-chip">{selectedMeetingDetail.groupVisibility}</span>
          <span className="mini-chip">{formatSessionPrice(selectedMeetingDetail)}</span>
          {selectedMeetingDetail.viewerHasClaimed ? <span className="mini-chip mini-chip--accent">Claimed</span> : null}
        </div>
      </div>
      {renderImagePane({
        imageUrl: selectedMeetingDetail.heroImageUrl,
        quote: selectedMeetingDetail.description || "No description yet.",
        title: selectedMeetingDetail.title,
      })}
      <p className="detail-quote detail-quote--hero">{selectedMeetingDetail.description || "No description yet."}</p>
      <section className="availability-callout">
        <span className="panel-caption">Availability</span>
        <strong>{selectedMeetingDetail.openSpots} spots open</strong>
        <span>{selectedMeetingDetail.claimedSpots}/{selectedMeetingDetail.capacity} claimed</span>
        {viewer ? (
          <div className="availability-callout__actions">
            {selectedMeetingDetail.viewerHasClaimed ? <span className="mini-chip mini-chip--success">You are attending</span> : null}
            <button className="button-primary button-inline" onClick={() => claimMutation.mutate(selectedMeetingDetail)} type="button">
              <Users size={14} strokeWidth={2} />
              {selectedMeetingDetail.viewerHasClaimed ? "Release your spot" : "Claim your spot"}
            </button>
          </div>
        ) : null}
      </section>
      <section className="info-grid">
        <div>
          <span className="panel-caption">Time</span>
          <strong>{formatDateTimeWithWeekdayShort(selectedMeetingDetail.startsAt)}</strong>
        </div>
        <div>
          <span className="panel-caption">Venue</span>
          <Link
            state={
              selectedMeetingDetail.venueId
                ? detailNavigationState({
                    itemMode: "venues",
                    selectedGroupId: null,
                    selectedMeetingClusterMeetingIds: [],
                    selectedMeetingClusterTitle: null,
                    selectedMeetingId: null,
                    selectedVenueId: selectedMeetingDetail.venueId,
                  })
                : undefined
            }
            to={selectedMeetingDetail.venueId ? `/venues/${selectedMeetingDetail.venueId}` : `/map?venue=${selectedMeetingDetail.venueId ?? ""}`}
          >
            {selectedMeetingDetail.locationName}
          </Link>
        </div>
        <div>
          <span className="panel-caption">Group</span>
          <Link
            state={detailNavigationState({
              itemMode: "groups",
              selectedGroupId: selectedMeetingDetail.groupId,
              selectedMeetingClusterMeetingIds: [],
              selectedMeetingClusterTitle: null,
              selectedMeetingId: null,
              selectedVenueId: null,
            })}
            to={`/groups/${selectedMeetingDetail.groupId}`}
          >
            {selectedMeetingDetail.groupName}
          </Link>
        </div>
        <div>
          <span className="panel-caption">Address</span>
          <strong>{selectedMeetingDetail.locationAddress}</strong>
        </div>
      </section>
      <section className="stack-panel">
        <span className="panel-caption">Attending Players</span>
        {selectedMeetingClaims.length > 0 ? (
          <div className="attending-player-list">
            {selectedMeetingClaims.map((claim) => (
              <Link className="attending-player-card" key={claim.id} state={detailNavigationState()} to={`/profile/${claim.id}`}>
                {claim.avatarUrl ? (
                  <img alt={claim.displayName} className="attending-player-card__avatar" src={claim.avatarUrl} />
                ) : (
                  <span className="attending-player-card__avatar attending-player-card__avatar--fallback" aria-hidden="true">
                    <User size={16} strokeWidth={2} />
                  </span>
                )}
                <span className="attending-player-card__copy">
                  <span className="attending-player-card__name">{claim.displayName}</span>
                  <span className="mini-chip">{formatPlayingLevelTag(claim.playingLevel)}</span>
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="muted-copy">Nobody has claimed a spot yet.</p>
        )}
      </section>
      <div className="subtle-action-row">
        <CopyTextButton label="Copy address" value={selectedMeetingDetail.locationAddress} />
        <a className="button-secondary button-inline" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedMeetingDetail.locationAddress)}`} rel="noreferrer" target="_blank">
          <Compass size={14} strokeWidth={2} />
          <span>Maps</span>
          <ExternalLink size={14} strokeWidth={2} />
        </a>
        {selectedMeetingDetail.viewerCanEdit ? (
          <>
            <button className="button-secondary button-inline" onClick={() => setEditingTarget({ kind: "meeting", mode: "single" })} type="button">
              <Edit3 size={14} strokeWidth={2} />
              Edit
            </button>
            {selectedMeetingDetail.seriesId ? (
              <button className="button-secondary button-inline" onClick={() => setEditingTarget({ kind: "meeting", mode: "series" })} type="button">
                <Shield size={14} strokeWidth={2} />
                Edit Series
              </button>
            ) : null}
          </>
        ) : null}
      </div>
      {selectedMeetingDetailQuery.data ? (
        <PostBoard
          buttonLabel="Post update"
          canPost={Boolean(viewer)}
          compact
          emptyLabel="No updates yet."
          onSubmit={async (content) => meetingPostMutation.mutateAsync(content)}
          posts={selectedMeetingDetailQuery.data.posts}
          title="Updates"
        />
      ) : null}
    </div>
  ) : selectedVenueDetail ? (
    <div className="info-panel">
      <div className="info-panel__sticky-title">
        {selectionHeaderActions}
        <div className="detail-card__eyebrow">
          <MapPin size={14} strokeWidth={2} />
          <span className="panel-caption">Venue</span>
        </div>
        <h2 className="info-panel__title">{selectedVenueDetail.name}</h2>
        <div className="info-tags">
          <span className="mini-chip">{selectedVenueDetail.pricing}</span>
          <span className="mini-chip">{selectedVenueMeetings.length} sessions</span>
        </div>
      </div>
      {renderImagePane({
        imageUrl: selectedVenueDetail.heroImageUrl,
        quote: selectedVenueDetail.description || "No description yet.",
        title: selectedVenueDetail.name,
      })}
      <p className="detail-quote detail-quote--hero">{selectedVenueDetail.description || "No description yet."}</p>
      <section className="info-grid">
        <div>
          <span className="panel-caption">Address</span>
          <strong>{selectedVenueDetail.address}</strong>
        </div>
        <div>
          <span className="panel-caption">Opening hours</span>
          <strong>{selectedVenueDetail.openingHoursText || "Check source before you go"}</strong>
        </div>
      </section>
      <div className="subtle-action-row">
        <CopyTextButton label="Copy address" value={selectedVenueDetail.address} />
        <a className="button-secondary button-inline" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedVenueDetail.address)}`} rel="noreferrer" target="_blank">
          <Compass size={14} strokeWidth={2} />
          <span>Maps</span>
          <ExternalLink size={14} strokeWidth={2} />
        </a>
        {(() => {
          const bookingUrl = selectedVenueDetail.bookingUrl?.trim() || null;
          const websiteUrl = selectedVenueDetail.websiteUrl?.trim() || selectedVenueDetail.sourceUrl?.trim() || null;
          const primaryUrl = bookingUrl ?? websiteUrl;
          if (!primaryUrl) {
            return null;
          }
          return (
            <a className="button-secondary button-inline" href={primaryUrl} rel="noreferrer" target="_blank">
              {bookingUrl ? "Booking" : "Website"}
            </a>
          );
        })()}
      </div>
      <EventTimeline
        contextLabel="Venue"
        emptyLabel="No sessions at this venue yet."
        heading={`Sessions @${selectedVenueDetail.name}`}
        meetings={selectedVenueMeetings}
        onSelectMeeting={selectMeeting}
        secondaryMeta="group"
        showGroupLabel
      />
    </div>
  ) : selectedGroupDetail ? (
    <div className="info-panel">
      <div className="info-panel__sticky-title">
        {selectionHeaderActions}
        <div className="detail-card__eyebrow">
          <Users size={14} strokeWidth={2} />
          <span className="panel-caption">Group</span>
        </div>
        <h2 className="info-panel__title">{selectedGroupDetail.name}</h2>
        <div className="info-tags">
          <span className="mini-chip">{selectedGroupDetail.visibility}</span>
          <span className="mini-chip">{selectedGroupMeetings.length} sessions</span>
          {selectedGroupDetail.viewerRole ? <span className="mini-chip mini-chip--accent">{selectedGroupDetail.viewerRole}</span> : null}
        </div>
      </div>
      {renderImagePane({
        imageUrl: selectedGroupDetail.heroImageUrl,
        quote: selectedGroupDetail.description || "No description yet.",
        title: selectedGroupDetail.name,
      })}
      <p className="detail-quote">{selectedGroupDetail.description || "No description yet."}</p>
      <section className="info-grid">
        <div>
          <span className="panel-caption">Activity</span>
          <strong>{selectedGroupDetail.activityLabel || "Beach volleyball"}</strong>
        </div>
        <div>
          <span className="panel-caption">Members</span>
          <strong>{selectedGroupDetailQuery.data?.members.length ?? selectedGroup?.memberCount ?? 0}</strong>
        </div>
      </section>
      <div className="subtle-action-row">
        {!selectedGroupDetail.viewerRole && viewer ? (
          <button className="button-primary button-inline" onClick={() => membershipMutation.mutate(selectedGroupDetail.id)} type="button">
            Request membership
          </button>
        ) : null}
        {selectedGroupDetail.messengerUrl ? <a className="button-secondary button-inline" href={selectedGroupDetail.messengerUrl} rel="noreferrer" target="_blank">Messenger</a> : null}
        {"viewerCanEditGroup" in selectedGroupDetail && selectedGroupDetail.viewerCanEditGroup ? (
          <button className="button-secondary button-inline" onClick={() => setEditingTarget({ kind: "group" })} type="button">
            <Edit3 size={14} strokeWidth={2} />
            Edit
          </button>
        ) : null}
      </div>
      {selectedGroupDetailQuery.data ? (
        <PostBoard
          buttonLabel="Post to group"
          canPost={Boolean(selectedGroupDetailQuery.data.group.viewerRole)}
          compact
          emptyLabel="No posts yet."
          onSubmit={async (content) => groupPostMutation.mutateAsync(content)}
          posts={selectedGroupDetailQuery.data.posts}
          title="Updates"
        />
      ) : null}
      <EventTimeline
        contextLabel="Group"
        emptyLabel="No sessions created by this group yet."
        heading={`Sessions from ${selectedGroupDetail.name}`}
        meetings={selectedGroupMeetings}
        onSelectMeeting={selectMeeting}
        secondaryMeta="location"
        showGroupLabel={false}
      />
    </div>
  ) : (
    <div className="info-panel info-panel--empty">
      <MessageSquare size={18} strokeWidth={2} />
      <h2 className="info-panel__title">Pick a court, group, or session.</h2>
      <p className="muted-copy">Details, sessions, actions, and updates appear here.</p>
      {showUpcomingSessions ? (
        <EventTimeline contextLabel="Workspace" emptyLabel="No sessions available." heading="Upcoming sessions" meetings={meetings} />
      ) : null}
    </div>
  );

  const renderFilterPanel = () => (
    <div className="filter-dropdown" ref={filterDropdownRef}>
      <button className="workspace-ghost-button workspace-ghost-button--filter" onClick={() => setShowMobileFilters((current) => !current)} type="button">
        <Filter size={14} strokeWidth={2} />
        <span>Filter</span>
      </button>
      {showMobileFilters ? (
        <div className="filter-dropdown__panel">
          <p className="panel-caption">Price</p>
          <div className="workspace-segmented workspace-segmented--fit filter-price-group">
            {(["all", "free", "paid"] as const).map((pricing) => (
              <button
                className={bounds.pricing === pricing ? "is-active" : ""}
                key={pricing}
                onClick={() =>
                  setBounds((current) => {
                    const next: DiscoveryBounds = {
                      ...current,
                      pricing,
                    };
                    normalizeWorkspacePath({ bounds: next });
                    return next;
                  })
                }
                type="button"
              >
                {pricing}
              </button>
            ))}
          </div>
          <p className="panel-caption">Time</p>
          <div className="time-filter-group">
            {(["all-sessions", "today", "tomorrow", "this-week", "next-week", "this-month", "custom"] as TimePreset[]).map((preset) => (
              <button
                className={timePreset === preset ? "is-active" : ""}
                key={preset}
                onClick={() => {
                  normalizeWorkspacePath({ timePreset: preset });
                  setTimePreset(preset);
                }}
                type="button"
              >
                {timePresetLabel(preset)}
              </button>
            ))}
          </div>
          {timePreset === "custom" ? (
            <div className="custom-range-grid">
              <label className="field-stack">
                <span className="field-label">From</span>
                <input
                  className="field-input"
                  onChange={(event) => {
                    normalizeWorkspacePath({ customStartAt: event.target.value });
                    setCustomStartAt(event.target.value);
                  }}
                  type="datetime-local"
                  value={customStartAt}
                />
              </label>
              <label className="field-stack">
                <span className="field-label">To</span>
                <input
                  className="field-input"
                  onChange={(event) => {
                    normalizeWorkspacePath({ customEndAt: event.target.value });
                    setCustomEndAt(event.target.value);
                  }}
                  type="datetime-local"
                  value={customEndAt}
                />
              </label>
            </div>
          ) : null}
          <p className="panel-caption">Availability</p>
          <button
            className={`filter-chip ${bounds.openOnly ? "is-active" : ""}`}
            onClick={() =>
              setBounds((current) => {
                const next = { ...current, openOnly: !current.openOnly };
                normalizeWorkspacePath({ bounds: next });
                return next;
              })
            }
            type="button"
          >
            Free spots only
          </button>
        </div>
      ) : null}
    </div>
  );

  const renderDisplaySwitch = () => (
    <button
      className="workspace-ghost-button workspace-ghost-button--display"
      onClick={() => {
        const nextDisplayMode = displayMode === "map" ? "list" : "map";
        normalizeWorkspacePath({ displayMode: nextDisplayMode });
        setDisplayMode(nextDisplayMode);
      }}
      type="button"
    >
      {displayMode === "map" ? <List size={14} strokeWidth={2} /> : <MapIcon size={14} strokeWidth={2} />}
      <span>{displayMode === "map" ? "List" : "Map"}</span>
    </button>
  );

  const renderModeSwitch = () => (
    <div className="workspace-segmented workspace-segmented--fit workspace-segmented--mode">
      <button className={itemMode === "venues" ? "is-active" : ""} onClick={() => setItemModeSafely("venues")} type="button">
        <MapPin size={14} strokeWidth={2} />
        <span>Venues</span>
      </button>
      <button className={itemMode === "groups" ? "is-active" : ""} onClick={() => setItemModeSafely("groups")} type="button">
        <Users size={14} strokeWidth={2} />
        <span>Groups</span>
      </button>
      <button
        className={itemMode === "sessions" ? "is-active" : ""}
        onClick={() => setItemModeSafely("sessions")}
        type="button"
      >
        <CalendarRange size={14} strokeWidth={2} />
        <span>Sessions</span>
      </button>
    </div>
  );

  const renderWorkspaceControls = () => (
    <div className="workspace-control-row">
      {renderFilterPanel()}
      {renderDisplaySwitch()}
    </div>
  );

  const listContent =
    itemMode === "sessions" ? (
      <EventTimeline
        contextLabel="Workspace"
        emptyLabel="No sessions match the current filters."
        meetings={meetings}
        onSelectMeeting={selectMeeting}
        selectedMeetingId={selectedMeetingId}
      />
    ) : (
      <div className="stack-list stack-list--compact">
        {itemMode === "venues"
          ? venues.map((venue) => (
              <button
                className={`browse-listing browse-listing--venue ${selectedVenueId === venue.id ? "is-selected" : ""}`}
                data-active-list-item={selectedVenueId === venue.id ? "true" : undefined}
                key={venue.id}
                onClick={() => selectVenue(venue)}
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
                      className={`browse-listing ${selectedGroupId === group.id ? "is-selected" : ""}`}
                      data-active-list-item={selectedGroupId === group.id ? "true" : undefined}
                      key={group.id}
                      onClick={() => selectGroup(group)}
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
                  className={`browse-listing ${selectedGroupId === group.id ? "is-selected" : ""}`}
                  data-active-list-item={selectedGroupId === group.id ? "true" : undefined}
                  key={group.id}
                  onClick={() => selectGroup(group)}
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

  const topCenterControls = (
    <div className="workspace-top-switches">
    </div>
  );

  return (
    <WorkspaceShell
      center={
        editPanel ? (
          editPanel
        ) : (
          <div
            className={`workspace-discovery-center ${displayMode === "map" ? "is-map" : "is-list"} ${
              hasSelection ? "workspace-main-center--covered" : ""
            }`.trim()}
          >
            <div className="map-overlay-controls">
              {renderWorkspaceControls()}
            </div>
            <div className="mode-overlay-controls">{renderModeSwitch()}</div>
            <MapView
              groupPins={groupPins}
              meetings={meetings}
              mode={itemMode}
              onBackgroundClick={handleMapBackgroundClick}
              onBoundsChange={() => undefined}
              onGroupSelect={selectGroupFromMap}
              onMeetingClusterSelect={selectMeetingClusterFromMap}
              onMeetingSelect={selectMeetingFromMap}
              onVenueSelect={selectVenueFromMap}
              selectionRevision={mapSelectionRevision}
              selectedKey={selectedMapKey}
              selectedLocation={selectedMapLocation}
              theme={theme}
              venueMeetingsById={venueMeetingsById}
              venues={venues}
              visible={displayMode === "map"}
            />
            <div aria-hidden={displayMode !== "list"} className="workspace-list-scroll" ref={listScrollRef}>
              <div className="workspace-list-heading">
                <p className="eyebrow">Browse</p>
                <h2 className="section-title typewriter-title">{listHeading}</h2>
              </div>
              {listContent}
            </div>
            {hasSelection ? (
              <aside className="mobile-details-drawer is-open">
                <div className="mobile-details-drawer__body">{selectionPanel}</div>
              </aside>
            ) : null}
          </div>
        )
      }
      left={
        <div className="stack-panel">
          <div className="workspace-segmented workspace-segmented--column workspace-segmented--mode-nav">
            <button
              className={displayMode === "map" ? "is-active" : ""}
              onClick={() => {
                normalizeWorkspacePath({ displayMode: "map" });
                setDisplayMode("map");
              }}
              type="button"
            >
              <MapIcon size={14} strokeWidth={2} />
              <span>Map</span>
            </button>
            <button
              className={displayMode === "list" ? "is-active" : ""}
              onClick={() => {
                normalizeWorkspacePath({ displayMode: "list" });
                setDisplayMode("list");
              }}
              type="button"
            >
              <List size={14} strokeWidth={2} />
              <span>List</span>
            </button>
          </div>

          <div className="workspace-segmented workspace-segmented--column workspace-segmented--mode-nav">
            <button className={itemMode === "venues" ? "is-active" : ""} onClick={() => setItemModeSafely("venues")} type="button">
              <MapPin size={14} strokeWidth={2} />
              <span>Venues</span>
            </button>
            <button className={itemMode === "groups" ? "is-active" : ""} onClick={() => setItemModeSafely("groups")} type="button">
              <Users size={14} strokeWidth={2} />
              <span>Groups</span>
            </button>
            <button className={itemMode === "sessions" ? "is-active" : ""} onClick={() => setItemModeSafely("sessions")} type="button">
              <CalendarRange size={14} strokeWidth={2} />
              <span>Sessions</span>
            </button>
          </div>

          <div className="stack-panel">
            <p className="panel-caption">Filters</p>
          <div className="time-filter-group">
              {(["all-sessions", "today", "tomorrow", "this-week", "next-week", "this-month", "custom"] as TimePreset[]).map((preset) => (
                <button
                className={timePreset === preset ? "is-active" : ""}
                key={preset}
                onClick={() => {
                  normalizeWorkspacePath({ timePreset: preset });
                  setTimePreset(preset);
                }}
                type="button"
              >
                {timePresetLabel(preset)}
                </button>
              ))}
            </div>
            {timePreset === "custom" ? (
              <div className="custom-range-grid">
                <label className="field-stack">
                  <span className="field-label">From</span>
                  <input
                    className="field-input"
                    onChange={(event) => {
                      normalizeWorkspacePath({ customStartAt: event.target.value });
                      setCustomStartAt(event.target.value);
                    }}
                    type="datetime-local"
                    value={customStartAt}
                  />
                </label>
                <label className="field-stack">
                  <span className="field-label">To</span>
                  <input
                    className="field-input"
                    onChange={(event) => {
                      normalizeWorkspacePath({ customEndAt: event.target.value });
                      setCustomEndAt(event.target.value);
                    }}
                    type="datetime-local"
                    value={customEndAt}
                  />
                </label>
              </div>
            ) : null}
            <FilterCheckbox
              checked={bounds.pricing !== "paid"}
              label="Free"
              onChange={(checked) =>
                setBounds((current) => {
                  const next: DiscoveryBounds = {
                    ...current,
                    pricing: checked ? (current.pricing === "paid" ? "all" : current.pricing) : "paid",
                  };
                  normalizeWorkspacePath({ bounds: next });
                  return next;
                })
              }
            />
            <FilterCheckbox
              checked={bounds.pricing !== "free"}
              label="Paid"
              onChange={(checked) =>
                setBounds((current) => {
                  const next: DiscoveryBounds = {
                    ...current,
                    pricing: checked ? (current.pricing === "free" ? "all" : current.pricing) : "free",
                  };
                  normalizeWorkspacePath({ bounds: next });
                  return next;
                })
              }
            />
            <FilterCheckbox
              checked={bounds.openOnly}
              label="Free spots only"
              onChange={(checked) =>
                setBounds((current) => {
                  const next = { ...current, openOnly: checked };
                  normalizeWorkspacePath({ bounds: next });
                  return next;
                })
              }
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
      overlay={
        fullscreenImage ? (
          <div className="fullscreen-image-view">
            <div className="fullscreen-image-view__scroller">
              <img alt={fullscreenImage.title} className="fullscreen-image-view__image" src={fullscreenImage.imageUrl} />
            </div>
            <h2 className="fullscreen-image-view__title">{fullscreenImage.title}</h2>
            <p className="fullscreen-image-view__quote">{fullscreenImage.quote}</p>
            <button
              aria-label="Close image"
              className="button-secondary workspace-panel-close-square fullscreen-image-view__close"
              onClick={() => setFullscreenImage(null)}
              type="button"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>
        ) : null
      }
      profileLinkState={headerProfileLinkState()}
      right={selectionPanel}
      rightHeader={undefined}
      theme={theme}
      title={selectedTitle}
      toggleTheme={toggleTheme}
      topCenter={topCenterControls}
      viewer={viewer}
    />
  );
}
