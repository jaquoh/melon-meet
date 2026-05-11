import type {
  FriendSummary,
  GroupPost,
  GroupSummary,
  MeetingPost,
  MeetingSummary,
  ModerationActionType,
  ModerationReportStatus,
  ModerationReportSummary,
  ModerationRole,
  MembershipRequestSummary,
  ReportReason,
  ReportTargetType,
  ViewerSummary,
  VenueSummary,
} from "../../../../packages/shared/src";

export interface MeResponse {
  friends: FriendSummary[];
  groups: GroupSummary[];
  viewer: ViewerSummary | null;
}

export interface AuthResponse {
  devVerificationUrl?: string | null;
  user: ViewerSummary;
  verificationRequired?: boolean;
}

export interface PublicConfigResponse {
  turnstileSiteKey: string | null;
}

export interface GroupDetailResponse {
  group: {
    activityLabel: string | null;
    createdAt: string;
    description: string;
    heroImageUrl: string | null;
    id: string;
    messengerUrl: string | null;
    name: string;
    ownerUserId: string;
    slug: string;
    updatedAt: string;
    viewerCanCreateMeeting: boolean;
    viewerCanEditGroup: boolean;
    viewerCanManageMembers: boolean;
    viewerRole: "owner" | "admin" | "member" | null;
    visibility: "public" | "private";
  };
  inviteLinks: Array<{ code: string; created_at: string; expires_at: string | null; id: string }>;
  meetings: MeetingSummary[];
  members: Array<{
    role: "owner" | "admin" | "member";
    user: ViewerSummary;
  }>;
  posts: GroupPost[];
}

export interface MeetingDetailResponse {
  claims: ViewerSummary[];
  meeting: MeetingSummary;
  posts: MeetingPost[];
  seriesMeetings: MeetingSummary[];
  viewerGroupRole: "owner" | "admin" | "member" | null;
}

export interface ProfileResponse {
  attending: MeetingSummary[];
  friendship: { id: string; status: "pending" | "accepted" } | null;
  memberships: Array<{ id: string; name: string; role: "owner" | "admin" | "member"; slug: string }>;
  profile: ViewerSummary;
  profileIsPrivate: boolean;
  responsible: MeetingSummary[];
}

export interface MapResponse {
  meetings: MeetingSummary[];
  venues: VenueSummary[];
}

export interface VenueDetailResponse {
  meetings: MeetingSummary[];
  venue: VenueSummary;
}

export interface ModerationReportsResponse {
  reports: ModerationReportSummary[];
  viewerModerationRole: ModerationRole;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const payload = (await response
      .json()
      .catch(() => ({ error: "Request failed." }))) as { error?: unknown; issues?: Array<{ message?: string }> };

    const message =
      typeof payload.error === "string"
        ? payload.error
        : Array.isArray(payload.issues) && payload.issues[0]?.message
          ? payload.issues[0].message
          : payload.error && typeof payload.error === "object" && "message" in payload.error
            ? String((payload.error as { message?: unknown }).message ?? "Request failed.")
            : "Request failed.";

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function getMe() {
  return request<MeResponse>("/api/me");
}

export function getPublicConfig() {
  return request<PublicConfigResponse>("/api/public-config");
}

export function signUp(email: string, password: string, turnstileToken?: string | null) {
  return request<AuthResponse>("/api/auth/signup", {
    body: JSON.stringify({ email, password, turnstileToken: turnstileToken ?? null }),
    method: "POST",
  });
}

export function logIn(email: string, password: string) {
  return request<AuthResponse>("/api/auth/login", {
    body: JSON.stringify({ email, password }),
    method: "POST",
  });
}

export function resendVerificationEmail() {
  return request<{ devVerificationUrl?: string | null; ok: true }>("/api/auth/verification/resend", {
    method: "POST",
  });
}

export function verifyEmailToken(token: string) {
  return request<{ ok: true }>("/api/auth/verify-email", {
    body: JSON.stringify({ token }),
    method: "POST",
  });
}

export function requestPasswordReset(email: string) {
  return request<{ devResetUrl?: string | null; message: string; ok: true }>("/api/auth/forgot-password", {
    body: JSON.stringify({ email }),
    method: "POST",
  });
}

export function resetPassword(token: string, password: string) {
  return request<{ ok: true }>("/api/auth/reset-password", {
    body: JSON.stringify({ token, password }),
    method: "POST",
  });
}

export function changePassword(currentPassword: string, password: string) {
  return request<{ ok: true }>("/api/auth/change-password", {
    body: JSON.stringify({ currentPassword, password }),
    method: "POST",
  });
}

export function requestEmailChange(currentPassword: string, email: string) {
  return request<{ devVerificationUrl?: string | null; ok: true }>("/api/auth/change-email", {
    body: JSON.stringify({ currentPassword, email }),
    method: "POST",
  });
}

export function verifyEmailChangeToken(token: string) {
  return request<{ email: string; ok: true }>("/api/auth/verify-email-change", {
    body: JSON.stringify({ token }),
    method: "POST",
  });
}

export function logOut() {
  return request<{ ok: true }>("/api/auth/logout", { method: "POST" });
}

export function logOutOtherSessions() {
  return request<{ ok: true }>("/api/auth/logout-other-sessions", { method: "POST" });
}

export function createReport(payload: {
  note?: string | null;
  reason: ReportReason;
  targetId: string;
  targetType: ReportTargetType;
}) {
  return request<{ ok: true }>("/api/reports", {
    body: JSON.stringify(payload),
    method: "POST",
  });
}

export function getModerationReports(status: "action_taken" | "all" | "closed_no_action" | "open" | "triaged" = "open") {
  return request<ModerationReportsResponse>(`/api/moderation/reports?status=${encodeURIComponent(status)}`);
}

export function updateModerationReport(
  reportId: string,
  payload: {
    assigneeUserId?: string | null;
    internalNotes?: string | null;
    resolution?: string | null;
    status?: ModerationReportStatus;
  },
) {
  return request<{ report: ModerationReportSummary }>(`/api/moderation/reports/${reportId}`, {
    body: JSON.stringify(payload),
    method: "PATCH",
  });
}

export function executeModerationAction(reportId: string, action: ModerationActionType) {
  return request<{ report: ModerationReportSummary }>(`/api/moderation/reports/${reportId}/actions`, {
    body: JSON.stringify({ action }),
    method: "POST",
  });
}

export function getGroups() {
  return request<{ groups: GroupSummary[] }>("/api/groups");
}

export function createGroup(payload: {
  activityLabel?: string | null;
  description: string;
  heroImageUrl?: string | null;
  messengerUrl?: string | null;
  name: string;
  slug: string;
  visibility: "public" | "private";
}) {
  return request<{ groupId: string }>("/api/groups", {
    body: JSON.stringify(payload),
    method: "POST",
  });
}

export function getGroup(groupId: string) {
  return request<GroupDetailResponse>(`/api/groups/${groupId}`);
}

export function updateGroup(groupId: string, payload: Record<string, unknown>) {
  return request<{ ok: true }>(`/api/groups/${groupId}`, {
    body: JSON.stringify(payload),
    method: "PATCH",
  });
}

export function deleteGroup(groupId: string) {
  return request<{ ok: true }>(`/api/groups/${groupId}`, {
    method: "DELETE",
  });
}

export function joinGroup(groupId: string) {
  return request<{ ok: true }>(`/api/groups/${groupId}/join`, { method: "POST" });
}

export function createMembershipRequest(groupId: string, note?: string) {
  return request<{ ok: true }>(`/api/groups/${groupId}/membership-requests`, {
    body: JSON.stringify({ note }),
    method: "POST",
  });
}

export function getMembershipRequests(groupId: string) {
  return request<{ requests: MembershipRequestSummary[] }>(`/api/groups/${groupId}/membership-requests`);
}

export function approveMembershipRequest(groupId: string, requestId: string) {
  return request<{ ok: true }>(`/api/groups/${groupId}/membership-requests/${requestId}/approve`, { method: "POST" });
}

export function rejectMembershipRequest(groupId: string, requestId: string) {
  return request<{ ok: true }>(`/api/groups/${groupId}/membership-requests/${requestId}/reject`, { method: "POST" });
}

export function createInviteLink(groupId: string) {
  return request<{ code: string }>(`/api/groups/${groupId}/invite-links`, { method: "POST" });
}

export function acceptInviteCode(code: string) {
  return request<{ ok: true }>(`/api/groups/invite-links/${code}/accept`, { method: "POST" });
}

export function updateMemberRole(
  groupId: string,
  userId: string,
  role: "admin" | "member",
) {
  return request<{ ok: true }>(`/api/groups/${groupId}/members/${userId}`, {
    body: JSON.stringify({ role }),
    method: "PATCH",
  });
}

export function createGroupPost(groupId: string, content: string) {
  return request<{ ok: true }>(`/api/groups/${groupId}/posts`, {
    body: JSON.stringify({ content }),
    method: "POST",
  });
}

export function getMap(params: {
  east: number;
  endAt?: string;
  north: number;
  openOnly: boolean;
  pricing: "all" | "free" | "paid";
  south: number;
  startAt?: string;
  west: number;
}) {
  const search = new URLSearchParams({
    east: String(params.east),
    north: String(params.north),
    openOnly: String(params.openOnly),
    pricing: params.pricing,
    south: String(params.south),
    west: String(params.west),
  });
  if (params.startAt) search.set("startAt", params.startAt);
  if (params.endAt) search.set("endAt", params.endAt);
  return request<MapResponse>(`/api/map?${search.toString()}`);
}

export function getVenue(venueId: string) {
  return request<VenueDetailResponse>(`/api/venues/${venueId}`);
}

export function getVenues() {
  return request<{ venues: VenueSummary[] }>("/api/venues");
}

export function createMeeting(payload: Record<string, unknown>) {
  return request<{ meetingId?: string; seriesId?: string }>("/api/meetings", {
    body: JSON.stringify(payload),
    method: "POST",
  });
}

export function getMeeting(meetingId: string) {
  return request<MeetingDetailResponse>(`/api/meetings/${meetingId}`);
}

export function updateMeeting(meetingId: string, payload: Record<string, unknown>) {
  return request<{ ok: true }>(`/api/meetings/${meetingId}`, {
    body: JSON.stringify(payload),
    method: "PATCH",
  });
}

export function claimMeeting(meetingId: string) {
  return request<{ ok: true }>(`/api/meetings/${meetingId}/claim`, { method: "POST" });
}

export function unclaimMeeting(meetingId: string) {
  return request<{ ok: true }>(`/api/meetings/${meetingId}/claim`, { method: "DELETE" });
}

export function cancelMeeting(meetingId: string) {
  return request<{ ok: true }>(`/api/meetings/${meetingId}/cancel`, { method: "POST" });
}

export function reviveMeeting(meetingId: string) {
  return request<{ ok: true }>(`/api/meetings/${meetingId}/revive`, { method: "POST" });
}

export function deleteMeeting(meetingId: string) {
  return request<{ ok: true }>(`/api/meetings/${meetingId}`, { method: "DELETE" });
}

export function createMeetingPost(meetingId: string, content: string) {
  return request<{ ok: true }>(`/api/meetings/${meetingId}/posts`, {
    body: JSON.stringify({ content }),
    method: "POST",
  });
}

export function getProfile(profileId: string) {
  return request<ProfileResponse>(`/api/profiles/${profileId}`);
}

export function updateProfile(profileId: string, payload: Record<string, unknown>) {
  return request<{ profile: ViewerSummary }>(`/api/profiles/${profileId}`, {
    body: JSON.stringify(payload),
    method: "PATCH",
  });
}

export function deleteProfile(profileId: string) {
  return request<{ ok: true }>(`/api/profiles/${profileId}`, {
    method: "DELETE",
  });
}

export function sendFriendRequest(payload: { targetEmail?: string; targetUserId?: string }) {
  return request<{ ok: true }>("/api/friends/requests", {
    body: JSON.stringify(payload),
    method: "POST",
  });
}

export function acceptFriendRequest(requestId: string) {
  return request<{ ok: true }>(`/api/friends/requests/${requestId}/accept`, { method: "POST" });
}

export function deleteFriend(connectionId: string) {
  return request<{ ok: true }>(`/api/friends/${connectionId}`, { method: "DELETE" });
}
