import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
import { useI18n } from "../lib/i18n";
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

function formatPlayingLevelTag(level: string | null | undefined) {
  const trimmed = level?.trim();
  return `LVL ${trimmed && trimmed.length > 0 ? trimmed : "?"}`;
}

function timePresetLabel(
  preset: TimePreset,
  t: (key: string, values?: Record<string, string | number | null | undefined>) => string,
) {
  if (preset === "all-sessions") return t("common.allSessions");
  if (preset === "next-week") return t("common.nextWeek");
  if (preset === "this-week") return t("common.thisWeek");
  if (preset === "this-month") return t("common.thisMonth");
  if (preset === "today") return t("common.today");
  if (preset === "tomorrow") return t("common.tomorrow");
  return t("common.custom");
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

function browseAccent(seed: string) {
  const palette = ["#8a6d52", "#576f86", "#6f7b5a", "#7c5f66", "#5c7070", "#7b694f"];
  let value = 0;
  for (const character of seed) {
    value = (value * 31 + character.charCodeAt(0)) % palette.length;
  }
  return palette[value] ?? palette[0];
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
  const { formatPrice, formatRole, formatVisibility, locale, t } = useI18n();
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
  const previousDisplayModeRef = useRef(displayMode);
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
  const createdSessionsHeading = isOwnProfile ? t("profile.ownCreatedSessions") : t("profile.createdSessions");
  const activeProfileDraft = profileDraft ?? (selectedProfileDetail ? createProfileDraft(selectedProfileDetail) : null);
  const selectedTitle =
    selectedMeetingDetail?.title ??
    selectedMeetingCluster?.title ??
    selectedVenueDetail?.name ??
    selectedGroupDetail?.name ??
    selectedProfileDetail?.displayName ??
    "";
  const listHeading =
    itemMode === "groups" ? t("discovery.listHeadingGroups") : itemMode === "venues" ? t("discovery.listHeadingVenues") : t("discovery.listHeadingSessions");
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
  const activeFilterTags = [
    timePreset !== "all-sessions" ? timePresetLabel(timePreset, t) : null,
    bounds.pricing !== "all" ? (bounds.pricing === "free" ? t("common.free") : t("common.paid")) : null,
    bounds.openOnly ? t("discovery.freeSpots") : null,
  ].filter((tag): tag is string => Boolean(tag));
  const hasActiveFilters = activeFilterTags.length > 0;
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
        setIsClearingSelection(false);
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
    window.scrollTo({ left: 0, top: 0 });
  }, [displayMode, selectedGroupId, selectedMeetingId, selectedVenueId]);

  useEffect(() => {
    setFullscreenImage(null);
  }, [selectedGroupId, selectedMeetingId, selectedVenueId]);

  useEffect(() => {
    const previousDisplayMode = previousDisplayModeRef.current;
    previousDisplayModeRef.current = displayMode;
    if (previousDisplayMode !== "map" || displayMode !== "list") {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      const listScroll = listScrollRef.current;
      const activeItem = listScroll?.querySelector<HTMLElement>('[data-active-list-item="true"]');
      if (!listScroll || !activeItem) {
        return;
      }
      const listRect = listScroll.getBoundingClientRect();
      const itemRect = activeItem.getBoundingClientRect();
      const scrollPadding = 16;
      if (itemRect.top >= listRect.top + scrollPadding && itemRect.bottom <= listRect.bottom - scrollPadding) {
        return;
      }
      const nextScrollTop =
        itemRect.top < listRect.top + scrollPadding
          ? listScroll.scrollTop + itemRect.top - listRect.top - scrollPadding
          : listScroll.scrollTop + itemRect.bottom - listRect.bottom + scrollPadding;
      listScroll.scrollTo({
        behavior: "smooth",
        top: nextScrollTop,
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [displayMode]);

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
          <p className="eyebrow">{t("discovery.editMode")}</p>
          <h2 className="screen-heading__title">{t("discovery.selectionGroup")}</h2>
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
              {t("common.cancel")}
            </button>
            <button className="button-primary" form="workspace-group-edit-form" type="submit">
              {t("common.save")}
            </button>
          </div>
        </div>
      </div>
    ) : editingTarget?.kind === "meeting" && selectedMeetingDetail ? (
      <div className="workspace-edit-surface">
        <div className="screen-heading">
          <p className="eyebrow">{t("discovery.editMode")}</p>
          <h2 className="screen-heading__title">{editingTarget.mode === "series" ? t("discovery.sessionSeries") : t("discovery.selectionSession")}</h2>
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
              {t("common.cancel")}
            </button>
            <button className="button-primary" form="workspace-meeting-edit-form" type="submit">
              {t("common.save")}
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
            <span className="panel-caption">{t("discovery.selectionProfile")}</span>
          </div>
          <h2 className="info-panel__title">{selectedProfileDetail.displayName}</h2>
          <div className="info-tags">
            <span className="mini-chip">{selectedProfileDetail.isProfilePublic ? t("common.public") : t("common.private")}</span>
            <span className="mini-chip">{formatPlayingLevelTag(selectedProfileDetail.playingLevel)}</span>
            {selectedProfileMemberships.length > 0 ? <span className="mini-chip">{`${selectedProfileMemberships.length} ${t("common.groups").toLowerCase()}`}</span> : null}
            {selectedProfileAttending.length > 0 ? <span className="mini-chip">{`${selectedProfileAttending.length} ${t("discovery.attending")}`}</span> : null}
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
                  {t("common.cancel")}
                </button>
                <button className="button-primary" form="workspace-profile-edit-form" type="submit">
                  {t("common.save")}
                </button>
              </div>
            </div>
          </>
          ) : null
        ) : (
          <>
            {selectedProfileDetailQuery.data?.profileIsPrivate && !isOwnProfile ? (
              <p className="muted-copy">{t("profile.privateProfile")}</p>
            ) : (
              <>
                <p className="detail-quote detail-quote--hero">{selectedProfileDetail.bio || t("profile.noBioYet")}</p>
                <section className="info-grid">
                  {selectedProfileDetail.homeArea ? (
                    <div>
                      <span className="panel-caption">{t("forms.homeArea")}</span>
                      <strong>{selectedProfileDetail.homeArea}</strong>
                    </div>
                  ) : null}
                  {selectedProfileDetail.email ? (
                    <div>
                      <span className="panel-caption">{t("landing.email")}</span>
                      <strong>{selectedProfileDetail.email}</strong>
                    </div>
                  ) : null}
                </section>
                {selectedProfileMemberships.length > 0 ? (
                  <div className="stack-panel">
                    <p className="panel-caption">{t("profile.groups")}</p>
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
                          {membership.name} · {formatRole(membership.role)}
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
                      {t("common.edit")}
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
                    emptyLabel={t("profile.noUpcomingSessions")}
                    heading={t("profile.attending")}
                    meetings={selectedProfileAttending}
                    onSelectMeeting={selectMeeting}
                    secondaryMeta="location"
                  />
                ) : null}
                {selectedProfileResponsible.length > 0 ? (
                  <EventTimeline
                    contextLabel="Profile"
                    emptyLabel={t("profile.noHostedSessions")}
                    heading={createdSessionsHeading}
                    meetings={selectedProfileResponsible}
                    onSelectMeeting={selectMeeting}
                    secondaryMeta="location"
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
        <h2 className="info-panel__title">{t("common.loadingProfile")}</h2>
      </div>
    ) : (
      <div className="info-panel info-panel--empty">
        <MessageSquare size={18} strokeWidth={2} />
        <h2 className="info-panel__title">{t("discovery.profileNotFound")}</h2>
      </div>
    )
  ) : selectedMeetingCluster ? (
    <div className="info-panel">
      <div className="info-panel__sticky-title">
        {selectionHeaderActions}
        <div className="detail-card__eyebrow">
          <CalendarRange size={14} strokeWidth={2} />
          <span className="panel-caption">{t("discovery.selectionCluster")}</span>
        </div>
        <h2 className="info-panel__title">{selectedMeetingCluster.title}</h2>
        <p className="muted-copy">{t("status.sessionsAtLocation", { count: selectedMeetingCluster.meetings.length })}</p>
      </div>
      <EventTimeline
        contextLabel="Workspace"
        emptyLabel={t("discovery.noSessionsAtLocation")}
        heading={t("discovery.sessionsAtLocation")}
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
          <span className="panel-caption">{t("discovery.selectionSession")}</span>
        </div>
        <h2 className={`info-panel__title ${selectedMeetingDetail.status === "cancelled" ? "session-title--cancelled" : ""}`.trim()}>
          {selectedMeetingDetail.title}
        </h2>
        <div className="info-tags">
          {selectedMeetingDetail.status === "cancelled" ? <span className="badge-cancelled">{t("common.cancelled")}</span> : null}
          <span className="mini-chip">{formatVisibility(selectedMeetingDetail.groupVisibility)}</span>
          <span className="mini-chip">{formatPrice(selectedMeetingDetail.pricing, selectedMeetingDetail.costPerPerson, true)}</span>
          {selectedMeetingDetail.viewerHasClaimed ? <span className="mini-chip mini-chip--accent">{t("common.claimed")}</span> : null}
        </div>
      </div>
      {renderImagePane({
        imageUrl: selectedMeetingDetail.heroImageUrl,
        quote: selectedMeetingDetail.description || t("common.noDescriptionYet"),
        title: selectedMeetingDetail.title,
      })}
      <p className="detail-quote detail-quote--hero">{selectedMeetingDetail.description || t("common.noDescriptionYet")}</p>
      <section className="availability-callout">
        <span className="panel-caption">{t("discovery.availability")}</span>
        <strong>{t("status.openSpots", { count: selectedMeetingDetail.openSpots })}</strong>
        <span>{t("status.claimedCount", { claimed: selectedMeetingDetail.claimedSpots, capacity: selectedMeetingDetail.capacity })}</span>
        {viewer ? (
          <div className="availability-callout__actions">
            {selectedMeetingDetail.viewerHasClaimed ? <span className="mini-chip mini-chip--success">{t("discovery.youAreAttending")}</span> : null}
            <button className="button-primary button-inline" onClick={() => claimMutation.mutate(selectedMeetingDetail)} type="button">
              <Users size={14} strokeWidth={2} />
              {selectedMeetingDetail.viewerHasClaimed ? t("discovery.releaseSpot") : "Claim your spot"}
            </button>
          </div>
        ) : null}
      </section>
      <section className="info-grid">
        <div>
          <span className="panel-caption">{t("discovery.time")}</span>
          <strong>{formatDateTimeWithWeekdayShort(selectedMeetingDetail.startsAt, locale)}</strong>
        </div>
        <div>
          <span className="panel-caption">{t("common.venue")}</span>
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
          <span className="panel-caption">{t("discovery.group")}</span>
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
          <span className="panel-caption">{t("forms.address")}</span>
          <strong>{selectedMeetingDetail.locationAddress}</strong>
        </div>
      </section>
      <section className="stack-panel">
        <span className="panel-caption">{t("discovery.attendingPlayers")}</span>
        {selectedMeetingClaims.length > 0 ? (
          <div className="attending-player-list">
            {selectedMeetingClaims.map((claim) => (
              <Link className="attending-player-card" key={claim.id} state={detailNavigationState()} to={`/profile/${claim.id}`}>
                {claim.avatarUrl ? (
                  <img alt={claim.displayName} className="attending-player-card__avatar" decoding="async" loading="lazy" src={claim.avatarUrl} />
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
          <p className="muted-copy">{t("discovery.nobodyClaimed")}</p>
        )}
      </section>
      <div className="subtle-action-row">
        <CopyTextButton label={t("discovery.copyAddress")} value={selectedMeetingDetail.locationAddress} />
        <a className="button-secondary button-inline" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedMeetingDetail.locationAddress)}`} rel="noreferrer" target="_blank">
          <Compass size={14} strokeWidth={2} />
          <span>{t("common.maps")}</span>
          <ExternalLink size={14} strokeWidth={2} />
        </a>
        {selectedMeetingDetail.viewerCanEdit ? (
          <>
            <button className="button-secondary button-inline" onClick={() => setEditingTarget({ kind: "meeting", mode: "single" })} type="button">
              <Edit3 size={14} strokeWidth={2} />
              {t("common.edit")}
            </button>
            {selectedMeetingDetail.seriesId ? (
              <button className="button-secondary button-inline" onClick={() => setEditingTarget({ kind: "meeting", mode: "series" })} type="button">
                <Shield size={14} strokeWidth={2} />
                {t("discovery.editSeries")}
              </button>
            ) : null}
          </>
        ) : null}
      </div>
      {selectedMeetingDetailQuery.data ? (
        <PostBoard
          buttonLabel={t("discovery.postUpdate")}
          canPost={Boolean(viewer)}
          compact
          emptyLabel={t("discovery.noUpdatesYet")}
          onSubmit={async (content) => meetingPostMutation.mutateAsync(content)}
          posts={selectedMeetingDetailQuery.data.posts}
          title={t("discovery.updatesTitle")}
        />
      ) : null}
    </div>
  ) : selectedVenueDetail ? (
    <div className="info-panel">
      <div className="info-panel__sticky-title">
        {selectionHeaderActions}
        <div className="detail-card__eyebrow">
          <MapPin size={14} strokeWidth={2} />
          <span className="panel-caption">{t("discovery.selectionVenue")}</span>
        </div>
        <h2 className="info-panel__title">{selectedVenueDetail.name}</h2>
        <div className="info-tags">
          <span className="mini-chip">{formatPrice(selectedVenueDetail.pricing, null)}</span>
          <span className="mini-chip">{t("status.sessions", { count: selectedVenueMeetings.length })}</span>
        </div>
      </div>
      {renderImagePane({
        imageUrl: selectedVenueDetail.heroImageUrl,
        quote: selectedVenueDetail.description || t("common.noDescriptionYet"),
        title: selectedVenueDetail.name,
      })}
      <p className="detail-quote detail-quote--hero">{selectedVenueDetail.description || t("common.noDescriptionYet")}</p>
      <section className="info-grid">
        <div>
          <span className="panel-caption">{t("forms.address")}</span>
          <strong>{selectedVenueDetail.address}</strong>
        </div>
        <div>
          <span className="panel-caption">{t("discovery.openingHours")}</span>
          <strong>{selectedVenueDetail.openingHoursText || t("discovery.openingHoursFallback")}</strong>
        </div>
      </section>
      <div className="subtle-action-row">
        <CopyTextButton label={t("discovery.copyAddress")} value={selectedVenueDetail.address} />
        <a className="button-secondary button-inline" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedVenueDetail.address)}`} rel="noreferrer" target="_blank">
          <Compass size={14} strokeWidth={2} />
          <span>{t("common.maps")}</span>
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
              {bookingUrl ? t("common.booking") : t("common.website")}
            </a>
          );
        })()}
      </div>
      <EventTimeline
        contextLabel="Venue"
        emptyLabel={t("discovery.noSessionsAtVenue")}
        heading={`Sessions @${selectedVenueDetail.name}`}
        meetings={selectedVenueMeetings}
        onSelectMeeting={selectMeeting}
        secondaryMeta="group"
      />
    </div>
  ) : selectedGroupDetail ? (
    <div className="info-panel">
      <div className="info-panel__sticky-title">
        {selectionHeaderActions}
        <div className="detail-card__eyebrow">
          <Users size={14} strokeWidth={2} />
          <span className="panel-caption">{t("discovery.selectionGroup")}</span>
        </div>
        <h2 className="info-panel__title">{selectedGroupDetail.name}</h2>
        <div className="info-tags">
          <span className="mini-chip">{formatVisibility(selectedGroupDetail.visibility)}</span>
          <span className="mini-chip">{t("status.sessions", { count: selectedGroupMeetings.length })}</span>
          {selectedGroupDetail.viewerRole ? <span className="mini-chip mini-chip--accent">{formatRole(selectedGroupDetail.viewerRole)}</span> : null}
        </div>
      </div>
      {renderImagePane({
        imageUrl: selectedGroupDetail.heroImageUrl,
        quote: selectedGroupDetail.description || t("common.noDescriptionYet"),
        title: selectedGroupDetail.name,
      })}
      <p className="detail-quote">{selectedGroupDetail.description || t("common.noDescriptionYet")}</p>
      <section className="info-grid">
        <div>
          <span className="panel-caption">{t("forms.activity")}</span>
          <strong>{selectedGroupDetail.activityLabel || t("discovery.activityFallback")}</strong>
        </div>
        <div>
          <span className="panel-caption">{t("discovery.members")}</span>
          <strong>{selectedGroupDetailQuery.data?.members.length ?? selectedGroup?.memberCount ?? 0}</strong>
        </div>
      </section>
      <div className="subtle-action-row">
        {!selectedGroupDetail.viewerRole && viewer ? (
          <button className="button-primary button-inline" onClick={() => membershipMutation.mutate(selectedGroupDetail.id)} type="button">
            {t("common.requestMembership")}
          </button>
        ) : null}
        {selectedGroupDetail.messengerUrl ? <a className="button-secondary button-inline" href={selectedGroupDetail.messengerUrl} rel="noreferrer" target="_blank">{t("common.messenger")}</a> : null}
        {"viewerCanEditGroup" in selectedGroupDetail && selectedGroupDetail.viewerCanEditGroup ? (
          <button className="button-secondary button-inline" onClick={() => setEditingTarget({ kind: "group" })} type="button">
            <Edit3 size={14} strokeWidth={2} />
            {t("common.edit")}
          </button>
        ) : null}
      </div>
      {selectedGroupDetailQuery.data ? (
        <PostBoard
          buttonLabel={t("discovery.postToGroup")}
          canPost={Boolean(selectedGroupDetailQuery.data.group.viewerRole)}
          compact
          emptyLabel={t("discovery.noPostsYet")}
          onSubmit={async (content) => groupPostMutation.mutateAsync(content)}
          posts={selectedGroupDetailQuery.data.posts}
          title={t("discovery.updatesTitle")}
        />
      ) : null}
      <EventTimeline
        contextLabel="Group"
        emptyLabel={t("discovery.noSessionsByGroup")}
        heading={`Sessions from ${selectedGroupDetail.name}`}
        meetings={selectedGroupMeetings}
        onSelectMeeting={selectMeeting}
        secondaryMeta="location"
      />
    </div>
  ) : (
    <div className="info-panel info-panel--empty">
      <MessageSquare size={18} strokeWidth={2} />
      <h2 className="info-panel__title">{t("discovery.emptyWorkspaceTitle")}</h2>
      <p className="muted-copy">{t("discovery.emptyWorkspaceText")}</p>
      {showUpcomingSessions ? (
        <EventTimeline contextLabel="Workspace" emptyLabel={t("discovery.noSessionsAvailable")} heading={t("discovery.upcomingSessions")} meetings={meetings} />
      ) : null}
    </div>
  );

  const renderFilterPanel = () => (
    <div className="filter-dropdown" ref={filterDropdownRef}>
      <div className="filter-trigger-stack">
        <button
          className={`workspace-ghost-button workspace-ghost-button--filter ${hasActiveFilters ? "is-active" : ""}`.trim()}
          onClick={() => setShowMobileFilters((current) => !current)}
          type="button"
        >
          <Filter size={14} strokeWidth={2} />
          <span>{t("common.filter")}</span>
        </button>
        <div className={`active-filter-tags ${hasActiveFilters ? "" : "is-empty"}`.trim()} aria-label={t("common.filters")}>
          {hasActiveFilters ? (
            activeFilterTags.map((tag) => (
              <span className="active-filter-tag" key={tag}>
                {tag}
              </span>
            ))
          ) : (
            <span className="active-filter-tag" aria-hidden="true">
              {t("common.all")}
            </span>
          )}
        </div>
      </div>
      {showMobileFilters ? (
        <div className="filter-dropdown__panel">
          <p className="panel-caption">{t("forms.pricing")}</p>
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
                {pricing === "all" ? t("common.all") : pricing === "free" ? t("common.free") : t("common.paid")}
              </button>
            ))}
          </div>
          <p className="panel-caption">{t("discovery.time")}</p>
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
                {timePresetLabel(preset, t)}
              </button>
            ))}
          </div>
          {timePreset === "custom" ? (
            <div className="custom-range-grid">
              <label className="field-stack">
                <span className="field-label">{t("common.from")}</span>
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
                <span className="field-label">{t("common.to")}</span>
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
          <p className="panel-caption">{t("discovery.availability")}</p>
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
            {t("discovery.freeSpotsOnly")}
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
      <span>{displayMode === "map" ? t("common.list") : t("common.map")}</span>
    </button>
  );

  const renderModeSwitch = () => (
    <div className="workspace-segmented workspace-segmented--fit workspace-segmented--mode">
      <button className={itemMode === "venues" ? "is-active" : ""} onClick={() => setItemModeSafely("venues")} type="button">
        <MapPin size={14} strokeWidth={2} />
        <span>{t("common.venues")}</span>
      </button>
      <button className={itemMode === "groups" ? "is-active" : ""} onClick={() => setItemModeSafely("groups")} type="button">
        <Users size={14} strokeWidth={2} />
        <span>{t("common.groups")}</span>
      </button>
      <button
        className={itemMode === "sessions" ? "is-active" : ""}
        onClick={() => setItemModeSafely("sessions")}
        type="button"
      >
        <CalendarRange size={14} strokeWidth={2} />
        <span>{t("common.sessions")}</span>
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
        emptyLabel={t("discovery.noSessionsFiltered")}
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
                style={{ "--timeline-accent": browseAccent(venue.id) } as CSSProperties}
                type="button"
              >
                <span className={`browse-listing__thumb ${venue.heroImageUrl ? "has-image" : ""}`.trim()} aria-hidden="true">
                  {venue.heroImageUrl ? <img alt="" decoding="async" loading="lazy" src={venue.heroImageUrl} /> : <MapPin size={18} strokeWidth={2} />}
                </span>
                <span className="browse-listing__body">
                  <span className="browse-listing__row">
                    <span className="browse-listing__copy-block">
                    <strong className="browse-listing__title">{venue.name}</strong>
                    <p className="browse-listing__meta">{venue.address}</p>
                    </span>
                    <span className="compact-badges">
                      <span className="badge-outline">{formatPrice(venue.pricing, null)}</span>
                      <span className="badge">{t("status.sessions", { count: venueMeetingsById[venue.id]?.length ?? 0 })}</span>
                    </span>
                  </span>
                  <span className="browse-listing__copy">{venue.description}</span>
                </span>
              </button>
            ))
          : <>
              {viewer && memberGroups.length > 0 ? <p className="list-separator list-separator--plain">{t("common.yourGroups")}</p> : null}
              {viewer
                ? memberGroups.map((group) => (
                    <button
                      className={`browse-listing ${selectedGroupId === group.id ? "is-selected" : ""}`}
                      data-active-list-item={selectedGroupId === group.id ? "true" : undefined}
                      key={group.id}
                      onClick={() => selectGroup(group)}
                      style={{ "--timeline-accent": browseAccent(group.id) } as CSSProperties}
                      type="button"
                    >
                      <span className={`browse-listing__thumb ${group.heroImageUrl ? "has-image" : ""}`.trim()} aria-hidden="true">
                        {group.heroImageUrl ? <img alt="" decoding="async" loading="lazy" src={group.heroImageUrl} /> : <Users size={18} strokeWidth={2} />}
                      </span>
                      <span className="browse-listing__body">
                        <span className="browse-listing__row">
                          <span className="browse-listing__copy-block">
                          <strong className="browse-listing__title">{group.name}</strong>
                            <p className="browse-listing__meta">{group.activityLabel || t("discovery.activityFallback")}</p>
                          </span>
                          <span className="compact-badges">
                            {group.viewerRole ? <span className="badge">{formatRole(group.viewerRole)}</span> : null}
                            <span className="badge-outline">{`${group.memberCount} ${t("common.members")}`}</span>
                            <span className="badge-outline">{t("status.sessions", { count: group.publicSessionCount })}</span>
                          </span>
                        </span>
                        <span className="browse-listing__copy">{group.description}</span>
                      </span>
                    </button>
                  ))
                : null}
              {viewer && memberGroups.length > 0 && publicGroups.length > 0 ? <div className="list-divider" /> : null}
              <p className="list-separator list-separator--plain">{t("discovery.publicGroups")}</p>
              {publicGroups.map((group) => (
                <button
                  className={`browse-listing ${selectedGroupId === group.id ? "is-selected" : ""}`}
                  data-active-list-item={selectedGroupId === group.id ? "true" : undefined}
                  key={group.id}
                  onClick={() => selectGroup(group)}
                  style={{ "--timeline-accent": browseAccent(group.id) } as CSSProperties}
                  type="button"
                >
                  <span className={`browse-listing__thumb ${group.heroImageUrl ? "has-image" : ""}`.trim()} aria-hidden="true">
                    {group.heroImageUrl ? <img alt="" decoding="async" loading="lazy" src={group.heroImageUrl} /> : <Users size={18} strokeWidth={2} />}
                  </span>
                  <span className="browse-listing__body">
                    <span className="browse-listing__row">
                      <span className="browse-listing__copy-block">
                      <strong className="browse-listing__title">{group.name}</strong>
                        <p className="browse-listing__meta">{group.activityLabel || t("discovery.activityFallback")}</p>
                      </span>
                      <span className="compact-badges">
                        <span className="badge-outline">{`${group.memberCount} ${t("common.members")}`}</span>
                        <span className="badge">{t("status.sessions", { count: group.publicSessionCount })}</span>
                      </span>
                    </span>
                    <span className="browse-listing__copy">{group.description}</span>
                  </span>
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
            {displayMode === "map" ? (
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
                visible
              />
            ) : null}
            <div aria-hidden={displayMode !== "list"} className="workspace-list-scroll" ref={listScrollRef}>
              <div className="workspace-list-heading">
                <p className="eyebrow">{t("common.browse")}</p>
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
              <span>{t("common.map")}</span>
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
              <span>{t("common.list")}</span>
            </button>
          </div>

          <div className="workspace-segmented workspace-segmented--column workspace-segmented--mode-nav">
            <button className={itemMode === "venues" ? "is-active" : ""} onClick={() => setItemModeSafely("venues")} type="button">
              <MapPin size={14} strokeWidth={2} />
              <span>{t("common.venues")}</span>
            </button>
            <button className={itemMode === "groups" ? "is-active" : ""} onClick={() => setItemModeSafely("groups")} type="button">
              <Users size={14} strokeWidth={2} />
              <span>{t("common.groups")}</span>
            </button>
            <button className={itemMode === "sessions" ? "is-active" : ""} onClick={() => setItemModeSafely("sessions")} type="button">
              <CalendarRange size={14} strokeWidth={2} />
              <span>{t("common.sessions")}</span>
            </button>
          </div>

          <div className="stack-panel">
            <p className="panel-caption">{t("common.filters")}</p>
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
                {timePresetLabel(preset, t)}
                </button>
              ))}
            </div>
            {timePreset === "custom" ? (
              <div className="custom-range-grid">
                <label className="field-stack">
                  <span className="field-label">{t("common.from")}</span>
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
                  <span className="field-label">{t("common.to")}</span>
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
              label={t("common.free")}
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
              label={t("common.paid")}
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
              label={t("discovery.freeSpotsOnly")}
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
            <p className="panel-caption">{t("common.yourGroups")}</p>
            {viewer ? (
              memberGroups.map((group) => (
                <Link className="mini-link" key={group.id} state={navState} to={`/groups/${group.id}`}>
                  {group.name} · {formatVisibility(group.visibility)}
                </Link>
              ))
            ) : (
              <p className="muted-copy">{t("profile.signInToParticipate")}</p>
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
              aria-label={t("discovery.viewImageClose")}
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
