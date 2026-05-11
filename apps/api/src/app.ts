import { zValidator } from "@hono/zod-validator";
import { format, getDay } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import type { Context } from "hono";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import {
  authSchema,
  friendRequestSchema,
  groupCreateSchema,
  groupPostSchema,
  groupUpdateSchema,
  mapQuerySchema,
  meetingCreateSchema,
  meetingUpdateSchema,
  moderationActionSchema,
  moderationReportUpdateSchema,
  postSchema,
  profileUpdateSchema,
  reportCreateSchema,
  roleUpdateSchema,
  type MeetingSummary,
  type ModerationRole,
  type ModerationActionType,
  type ModerationReportStatus,
  type ReportTargetType,
  type VenueSummary,
  type ViewerSummary,
} from "../../../packages/shared/src";
import {
  clearSessionCookie,
  createSession,
  generateOpaqueToken,
  hashOpaqueToken,
  hashPassword,
  readSessionCookie,
  revokeOtherSessionsForUser,
  resolveSessionViewer,
  revokeAllSessionsForUser,
  revokeSessionByToken,
  verifyPassword,
  writeSessionCookie,
} from "./lib/auth";
import { writeAuditLogEvent } from "./lib/audit-log";
import { allRows, firstRow, runStatement } from "./lib/db";
import { sendResendEmail } from "./lib/email";
import { assertOrThrow } from "./lib/http";
import { reportOperationalError } from "./lib/monitoring";
import { consumeRateLimit } from "./lib/rate-limit";
import { logSecurityEvent, maskEmailAddress } from "./lib/security-log";
import {
  durationMinutes,
  horizonDate,
  isoToLocalDate,
  isoToLocalTime,
  isoToWeekday,
  nowIso,
} from "./lib/time";
import { ensureSeriesCoverage } from "./services/series";
import type { AppEnv } from "./types/env";

type GroupRole = "owner" | "admin" | "member";
type GroupVisibility = "public" | "private";
type AccountStatus = "active" | "deletion-pending" | "suspended";

const AUTH_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const AUTH_RATE_LIMIT_MAX_ATTEMPTS = 8;
const WRITE_SHORT_WINDOW_MS = 10 * 60 * 1000;
const WRITE_MEDIUM_WINDOW_MS = 60 * 60 * 1000;
const EMAIL_VERIFICATION_TTL_MS = 1000 * 60 * 60 * 24;
const EMAIL_CHANGE_TTL_MS = 1000 * 60 * 60 * 24;
const PASSWORD_RESET_TTL_MS = 1000 * 60 * 60;
const ACCOUNT_DELETION_RETENTION_MS = 1000 * 60 * 60 * 24 * 30;
const POST_COOLDOWN_MS = 30 * 1000;
const DUPLICATE_POST_WINDOW_MS = 1000 * 60 * 60 * 12;
const MEMBERSHIP_REQUEST_COOLDOWN_MS = 1000 * 60 * 60 * 24;
const INVITE_LINK_COOLDOWN_MS = 1000 * 60 * 5;
const ACTIVE_ACCOUNT_STATUS: AccountStatus = "active";
const DELETION_PENDING_ACCOUNT_STATUS: AccountStatus = "deletion-pending";
const DELETED_USER_DISPLAY_NAME = "Deleted user";

const WRITE_RATE_LIMITS = {
  "write:friend-request": {
    limit: 12,
    message: "Too many friend requests. Please wait a bit before sending more.",
    windowMs: WRITE_MEDIUM_WINDOW_MS,
  },
  "write:group-create": {
    limit: 3,
    message: "Too many group creation attempts. Please wait before creating another group.",
    windowMs: WRITE_MEDIUM_WINDOW_MS,
  },
  "write:group-update": {
    limit: 20,
    message: "Too many group edits. Please wait a bit before making more changes.",
    windowMs: WRITE_MEDIUM_WINDOW_MS,
  },
  "write:group-membership-request": {
    limit: 8,
    message: "Too many membership requests. Please wait before requesting more groups.",
    windowMs: WRITE_MEDIUM_WINDOW_MS,
  },
  "write:group-invite-link-create": {
    limit: 10,
    message: "Too many invite links created. Please wait a bit before creating more.",
    windowMs: WRITE_MEDIUM_WINDOW_MS,
  },
  "write:group-post": {
    limit: 12,
    message: "Too many group posts in a short time. Please wait before posting again.",
    windowMs: WRITE_SHORT_WINDOW_MS,
  },
  "write:meeting-create": {
    limit: 10,
    message: "Too many meeting creation attempts. Please wait before creating another session.",
    windowMs: WRITE_MEDIUM_WINDOW_MS,
  },
  "write:meeting-post": {
    limit: 12,
    message: "Too many meeting posts in a short time. Please wait before posting again.",
    windowMs: WRITE_SHORT_WINDOW_MS,
  },
  "write:meeting-update": {
    limit: 24,
    message: "Too many meeting edits. Please wait a bit before making more changes.",
    windowMs: WRITE_MEDIUM_WINDOW_MS,
  },
} as const;

type WriteRateLimitScope = keyof typeof WRITE_RATE_LIMITS;

const moderationReportListQuerySchema = z.object({
  status: z.enum(["all", "open", "triaged", "action_taken", "closed_no_action"]).default("open"),
});

type ViewerRow = {
  avatar_url: string | null;
  bio: string;
  display_name: string;
  email: string;
  email_verified_at?: string | null;
  home_area: string;
  id: string;
  is_profile_public?: number | boolean;
  playing_level?: string | null;
  show_email_publicly?: number | boolean;
};

type HeroImageRow = {
  hero_image_url?: string | null;
};

type VenueRow = {
  access_type: VenueSummary["accessType"];
  address: string;
  amenities_json: string | null;
  booking_url: string | null;
  court_count_total: number | null;
  description: string;
  duplicate_notes: string | null;
  environment: VenueSummary["environment"];
  facts_json: string | null;
  google_maps_url: string | null;
  hero_image_url: string | null;
  id: string;
  image_gallery_json: string | null;
  indoor_court_count: number | null;
  latitude: number;
  longitude: number;
  name: string;
  opening_hours_text: string | null;
  outdoor_court_count: number | null;
  pricing: "free" | "paid";
  researched_at: string | null;
  seasonality_text: string | null;
  source_url: string | null;
  source_urls_json: string | null;
  website_url: string | null;
};

type ModerationReportRow = {
  assignee_avatar_url: string | null;
  assignee_bio: string;
  assignee_display_name: string;
  assignee_email: string;
  assignee_email_verified_at: string | null;
  assignee_home_area: string;
  assignee_id: string | null;
  assignee_is_profile_public: number;
  assignee_playing_level: string | null;
  assignee_show_email_publicly: number;
  created_at: string;
  id: string;
  internal_notes: string | null;
  note: string | null;
  reason: string;
  reporter_avatar_url: string | null;
  reporter_bio: string;
  reporter_display_name: string;
  reporter_email: string;
  reporter_email_verified_at: string | null;
  reporter_home_area: string;
  reporter_id: string;
  reporter_is_profile_public: number;
  reporter_playing_level: string | null;
  reporter_show_email_publicly: number;
  resolution: string | null;
  status: ModerationReportStatus;
  target_id: string;
  target_type: ReportTargetType;
  updated_at: string;
};

function parseJsonArray(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseVenueFacts(value: string | null | undefined): VenueSummary["facts"] {
  const fallback: VenueSummary["facts"] = {
    areaNotes: [],
    equipment: [],
    parkInspectorScore: null,
    playerLevel: null,
    surface: null,
  };

  if (!value) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") {
      return fallback;
    }
    const candidate = parsed as Partial<VenueSummary["facts"]>;
    return {
      areaNotes: Array.isArray(candidate.areaNotes) ? candidate.areaNotes.filter((entry): entry is string => typeof entry === "string") : [],
      equipment: Array.isArray(candidate.equipment) ? candidate.equipment.filter((entry): entry is string => typeof entry === "string") : [],
      parkInspectorScore: typeof candidate.parkInspectorScore === "number" ? candidate.parkInspectorScore : null,
      playerLevel: typeof candidate.playerLevel === "string" ? candidate.playerLevel : null,
      surface: typeof candidate.surface === "string" ? candidate.surface : null,
    };
  } catch {
    return fallback;
  }
}

function mapVenueSummary(venue: VenueRow): VenueSummary {
  return {
    accessType: venue.access_type,
    address: venue.address,
    amenities: parseJsonArray(venue.amenities_json).filter((entry): entry is string => typeof entry === "string"),
    bookingUrl: venue.booking_url,
    courtCountTotal: venue.court_count_total,
    description: venue.description,
    duplicateNotes: venue.duplicate_notes,
    environment: venue.environment,
    facts: parseVenueFacts(venue.facts_json),
    googleMapsUrl: venue.google_maps_url ?? buildGoogleMapsUrl(venue.address, Number(venue.latitude), Number(venue.longitude)),
    heroImageUrl: venue.hero_image_url,
    id: venue.id,
    imageGallery: parseJsonArray(venue.image_gallery_json).filter(
      (entry): entry is VenueSummary["imageGallery"][number] =>
        Boolean(entry) &&
        typeof entry === "object" &&
        typeof (entry as { url?: unknown }).url === "string" &&
        typeof (entry as { sourceUrl?: unknown }).sourceUrl === "string" &&
        typeof (entry as { credit?: unknown }).credit === "string" &&
        typeof (entry as { license?: unknown }).license === "string" &&
        ((entry as { rightsStatus?: unknown }).rightsStatus === "usable" || (entry as { rightsStatus?: unknown }).rightsStatus === "requires_permission"),
    ),
    indoorCourtCount: Number(venue.indoor_court_count ?? 0),
    latitude: Number(venue.latitude),
    longitude: Number(venue.longitude),
    name: venue.name,
    openingHoursText: venue.opening_hours_text,
    outdoorCourtCount: Number(venue.outdoor_court_count ?? 0),
    pricing: venue.pricing,
    researchedAt: venue.researched_at,
    seasonalityText: venue.seasonality_text,
    sourceUrl: venue.source_url,
    sourceUrls: parseJsonArray(venue.source_urls_json).filter((entry): entry is string => typeof entry === "string"),
    websiteUrl: venue.website_url,
  };
}

function normalizeOptionalText(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeComparableText(value: string | null | undefined) {
  return normalizeOptionalText(value)?.toLowerCase().replace(/\s+/g, " ") ?? "";
}

function isRecentIsoTimestamp(value: string, windowMs: number) {
  return Date.now() - new Date(value).getTime() < windowMs;
}

function makeInviteCode() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

function deletedUserEmail(userId: string) {
  return `deleted+${userId}@deleted.invalid`;
}

async function assertPostNotSpammy(
  db: D1Database,
  options: {
    authorUserId: string;
    content: string;
    scopeId: string;
    scopeLabel: string;
    scopeColumn: "group_id" | "meeting_id";
    table: "group_posts" | "meeting_posts";
  },
) {
  const recentPosts = await allRows<{ content: string; created_at: string }>(
    db,
    `SELECT content, created_at
     FROM ${options.table}
     WHERE ${options.scopeColumn} = ?
       AND author_user_id = ?
       AND created_at >= ?
     ORDER BY created_at DESC
     LIMIT 10`,
    options.scopeId,
    options.authorUserId,
    new Date(Date.now() - DUPLICATE_POST_WINDOW_MS).toISOString(),
  );

  const latestPost = recentPosts[0];
  if (latestPost && isRecentIsoTimestamp(latestPost.created_at, POST_COOLDOWN_MS)) {
    throw new HTTPException(429, {
      message: `Please wait a little before posting again in this ${options.scopeLabel}.`,
    });
  }

  const comparableContent = normalizeComparableText(options.content);
  if (recentPosts.some((post) => normalizeComparableText(post.content) === comparableContent)) {
    throw new HTTPException(409, {
      message: `That message was already posted in this ${options.scopeLabel} recently.`,
    });
  }
}

async function assertReportTargetExists(
  db: D1Database,
  viewerId: string,
  targetType: ReportTargetType,
  targetId: string,
) {
  if (targetType === "profile") {
    const row = await firstRow<{ id: string }>(db, "SELECT id FROM users WHERE id = ?", targetId);
    assertOrThrow(row, 404, "Report target not found.");
    return;
  }

  if (targetType === "group") {
    await assertCanAccessGroup(db, targetId, viewerId);
    return;
  }

  if (targetType === "meeting") {
    await getMeetingDetail(db, targetId, viewerId);
    return;
  }

  if (targetType === "group_post") {
    const post = await firstRow<{ group_id: string }>(
      db,
      `SELECT gp.group_id
       FROM group_posts gp
       JOIN app_groups g ON g.id = gp.group_id
       WHERE gp.id = ?
         AND g.archived_at IS NULL`,
      targetId,
    );
    assertOrThrow(post, 404, "Report target not found.");
    await assertCanAccessGroup(db, post.group_id, viewerId);
    return;
  }

  if (targetType === "meeting_post") {
    const post = await firstRow<{ meeting_id: string }>(
      db,
      `SELECT mp.meeting_id
       FROM meeting_posts mp
       JOIN meetings m ON m.id = mp.meeting_id
       WHERE mp.id = ?
         AND m.archived_at IS NULL`,
      targetId,
    );
    assertOrThrow(post, 404, "Report target not found.");
    await getMeetingDetail(db, post.meeting_id, viewerId);
    return;
  }

  const group = await firstRow<{ id: string; visibility: GroupVisibility }>(
    db,
    "SELECT id, visibility FROM app_groups WHERE id = ? AND archived_at IS NULL",
    targetId,
  );
  assertOrThrow(group, 404, "Report target not found.");
  assertOrThrow(group.visibility === "private", 400, "Invite abuse reports only apply to private groups.");
  await assertCanAccessGroup(db, group.id, viewerId);
}

async function resolveModerationReportTargetLabel(
  db: D1Database,
  targetType: ReportTargetType,
  targetId: string,
) {
  if (targetType === "profile") {
    const row = await firstRow<{ display_name: string }>(db, "SELECT display_name FROM users WHERE id = ?", targetId);
    return row ? `Profile: ${row.display_name}` : `Profile ${targetId}`;
  }

  if (targetType === "group" || targetType === "invite_abuse") {
    const row = await firstRow<{ name: string }>(db, "SELECT name FROM app_groups WHERE id = ?", targetId);
    return row ? `${targetType === "invite_abuse" ? "Invite abuse" : "Group"}: ${row.name}` : `${targetType === "invite_abuse" ? "Invite abuse" : "Group"} ${targetId}`;
  }

  if (targetType === "meeting") {
    const row = await firstRow<{ title: string }>(db, "SELECT title FROM meetings WHERE id = ?", targetId);
    return row ? `Session: ${row.title}` : `Session ${targetId}`;
  }

  if (targetType === "group_post") {
    const row = await firstRow<{ group_name: string; content: string }>(
      db,
      `SELECT g.name AS group_name, gp.content
       FROM group_posts gp
       JOIN app_groups g ON g.id = gp.group_id
       WHERE gp.id = ?`,
      targetId,
    );
    return row ? `Group post in ${row.group_name}: ${row.content.slice(0, 80)}` : `Group post ${targetId}`;
  }

  const row = await firstRow<{ meeting_title: string; content: string }>(
    db,
    `SELECT m.title AS meeting_title, mp.content
     FROM meeting_posts mp
     JOIN meetings m ON m.id = mp.meeting_id
     WHERE mp.id = ?`,
    targetId,
  );
  return row ? `Session post in ${row.meeting_title}: ${row.content.slice(0, 80)}` : `Session post ${targetId}`;
}

async function mapModerationReportSummary(db: D1Database, env: AppEnv["Bindings"], row: ModerationReportRow) {
  const reporter = applyModerationRoleToViewer(env, mapViewerSummary({
    avatar_url: row.reporter_avatar_url,
    bio: row.reporter_bio,
    display_name: row.reporter_display_name,
    email: row.reporter_email,
    email_verified_at: row.reporter_email_verified_at,
    home_area: row.reporter_home_area,
    id: row.reporter_id,
    is_profile_public: row.reporter_is_profile_public,
    playing_level: row.reporter_playing_level,
    show_email_publicly: row.reporter_show_email_publicly,
  }));

  const assignee =
    row.assignee_id
      ? applyModerationRoleToViewer(env, mapViewerSummary({
          avatar_url: row.assignee_avatar_url,
          bio: row.assignee_bio,
          display_name: row.assignee_display_name,
          email: row.assignee_email,
          email_verified_at: row.assignee_email_verified_at,
          home_area: row.assignee_home_area,
          id: row.assignee_id,
          is_profile_public: row.assignee_is_profile_public,
          playing_level: row.assignee_playing_level,
          show_email_publicly: row.assignee_show_email_publicly,
        }))
      : null;

  return {
    assignee,
    createdAt: row.created_at,
    id: row.id,
    internalNotes: row.internal_notes,
    note: row.note,
    reason: row.reason,
    reporter,
    resolution: row.resolution,
    status: row.status,
    targetId: row.target_id,
    targetLabel: await resolveModerationReportTargetLabel(db, row.target_type, row.target_id),
    targetPath: reportTargetPath(row.target_type, row.target_id),
    targetType: row.target_type,
    updatedAt: row.updated_at,
  };
}

function moderationActionResolution(action: ModerationActionType) {
  if (action === "suspend_user") return "Admin suspended the reported user account.";
  if (action === "archive_group") return "Admin archived the reported group.";
  if (action === "cancel_meeting") return "Admin cancelled the reported session.";
  if (action === "archive_meeting") return "Admin archived the reported session.";
  if (action === "remove_group_post") return "Admin removed the reported group post.";
  if (action === "remove_meeting_post") return "Admin removed the reported session post.";
  return "Admin revoked invite links for the reported group.";
}

async function executeModerationAction(
  db: D1Database,
  report: { target_id: string; target_type: ReportTargetType },
  action: ModerationActionType,
) {
  if (action === "suspend_user") {
    assertOrThrow(report.target_type === "profile", 400, "This action only applies to profile reports.");
    await runStatement(
      db,
      "UPDATE users SET account_status = ?, updated_at = ? WHERE id = ?",
      "suspended",
      nowIso(),
      report.target_id,
    );
    await revokeAllSessionsForUser(db, report.target_id);
    return;
  }

  if (action === "archive_group") {
    assertOrThrow(report.target_type === "group", 400, "This action only applies to group reports.");
    const timestamp = nowIso();
    await runStatement(
      db,
      "UPDATE app_groups SET archived_at = ?, updated_at = ? WHERE id = ?",
      timestamp,
      timestamp,
      report.target_id,
    );
    return;
  }

  if (action === "cancel_meeting") {
    assertOrThrow(report.target_type === "meeting", 400, "This action only applies to session reports.");
    await runStatement(
      db,
      "UPDATE meetings SET status = 'cancelled', updated_at = ? WHERE id = ?",
      nowIso(),
      report.target_id,
    );
    return;
  }

  if (action === "archive_meeting") {
    assertOrThrow(report.target_type === "meeting", 400, "This action only applies to session reports.");
    const timestamp = nowIso();
    await runStatement(
      db,
      "UPDATE meetings SET status = 'cancelled', archived_at = ?, updated_at = ? WHERE id = ?",
      timestamp,
      timestamp,
      report.target_id,
    );
    return;
  }

  if (action === "remove_group_post") {
    assertOrThrow(report.target_type === "group_post", 400, "This action only applies to group-post reports.");
    await runStatement(db, "DELETE FROM group_posts WHERE id = ?", report.target_id);
    return;
  }

  if (action === "remove_meeting_post") {
    assertOrThrow(report.target_type === "meeting_post", 400, "This action only applies to session-post reports.");
    await runStatement(db, "DELETE FROM meeting_posts WHERE id = ?", report.target_id);
    return;
  }

  assertOrThrow(report.target_type === "invite_abuse" || report.target_type === "group", 400, "This action only applies to group invite reports.");
  await runStatement(db, "DELETE FROM group_invite_links WHERE group_id = ?", report.target_id);
}

function mapViewerSummary(row: ViewerRow) {
  return {
    avatarUrl: row.avatar_url,
    bio: row.bio,
    displayName: row.display_name,
    email: row.email,
    emailVerified: Boolean(row.email_verified_at),
    homeArea: row.home_area,
    id: row.id,
    isProfilePublic: Boolean(row.is_profile_public),
    moderationRole: null,
    playingLevel: row.playing_level?.trim() ?? "",
    showEmailPublicly: Boolean(row.show_email_publicly),
  };
}

function maskViewerEmail(viewer: ReturnType<typeof mapViewerSummary>) {
  return {
    ...viewer,
    email: viewer.showEmailPublicly ? viewer.email : "",
  };
}

function buildGoogleMapsUrl(address: string, latitude: number, longitude: number) {
  const query = address || `${latitude},${longitude}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function getClientAddress(c: Context<AppEnv>) {
  const forwardedIp = c.req.header("CF-Connecting-IP");
  if (forwardedIp) {
    return forwardedIp;
  }

  const xForwardedFor = c.req.header("X-Forwarded-For");
  if (xForwardedFor) {
    return xForwardedFor.split(",")[0]?.trim() ?? "unknown-ip";
  }

  return "unknown-ip";
}

function appOrigin(c: Context<AppEnv>) {
  return new URL(c.req.url).origin;
}

function isLocalOrigin(c: Context<AppEnv>) {
  const { hostname } = new URL(c.req.url);
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function turnstileConfigured(c: Context<AppEnv>) {
  return Boolean(c.env.TURNSTILE_SECRET_KEY && c.env.TURNSTILE_SITE_KEY);
}

function requestOriginFromHeaders(c: Context<AppEnv>) {
  const originHeader = c.req.header("Origin");
  if (originHeader) {
    try {
      return new URL(originHeader).origin;
    } catch {
      return null;
    }
  }

  const refererHeader = c.req.header("Referer");
  if (refererHeader) {
    try {
      return new URL(refererHeader).origin;
    } catch {
      return null;
    }
  }

  return null;
}

function buildVerifyEmailUrl(c: Context<AppEnv>, token: string) {
  return `${appOrigin(c)}/verify-email?token=${encodeURIComponent(token)}`;
}

function buildResetPasswordUrl(c: Context<AppEnv>, token: string) {
  return `${appOrigin(c)}/reset-password?token=${encodeURIComponent(token)}`;
}

function buildVerifyEmailChangeUrl(c: Context<AppEnv>, token: string) {
  return `${appOrigin(c)}/verify-email-change?token=${encodeURIComponent(token)}`;
}

function localDevLink(c: Context<AppEnv>, url: string) {
  return isLocalOrigin(c) ? url : null;
}

function parseEmailAllowlist(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.length > 0),
  );
}

function moderationRoleForEmail(env: AppEnv["Bindings"], email: string): ModerationRole | null {
  const normalizedEmail = email.trim().toLowerCase();
  const adminEmails = parseEmailAllowlist(env.MODERATION_ADMIN_EMAILS);
  if (adminEmails.has(normalizedEmail)) {
    return "admin";
  }

  const reviewerEmails = parseEmailAllowlist(env.MODERATION_REVIEWER_EMAILS);
  if (reviewerEmails.has(normalizedEmail)) {
    return "support_reviewer";
  }

  return null;
}

function applyModerationRoleToViewer(env: AppEnv["Bindings"], viewer: ViewerSummary) {
  return {
    ...viewer,
    moderationRole: moderationRoleForEmail(env, viewer.email),
  };
}

async function requireModerationViewer(c: Context<AppEnv>, minimumRole: ModerationRole = "support_reviewer") {
  const viewer = await requireViewer(c);
  const role = viewer.moderationRole;
  const allowed = minimumRole === "support_reviewer" ? role === "support_reviewer" || role === "admin" : role === "admin";
  assertOrThrow(allowed, 403, "You do not have moderation access.");
  return viewer;
}

function reportTargetPath(targetType: ReportTargetType, targetId: string) {
  if (targetType === "profile") {
    return `/profile/${targetId}`;
  }
  if (targetType === "group" || targetType === "invite_abuse") {
    return `/groups/${targetId}`;
  }
  if (targetType === "meeting") {
    return `/sessions/${targetId}`;
  }
  return null;
}

async function sendAccountEmail(
  c: Context<AppEnv>,
  {
    html,
    subject,
    text,
    to,
  }: {
    html: string;
    subject: string;
    text: string;
    to: string;
  },
) {
  if (!c.env.RESEND_API_KEY) {
    assertOrThrow(isLocalOrigin(c), 500, "Email service is not configured.");
    return;
  }

  await sendResendEmail(c.env, {
    html,
    subject,
    text,
    to,
  });
}

async function issueEmailVerificationToken(c: Context<AppEnv>, userId: string, email: string) {
  const token = generateOpaqueToken();
  const tokenHash = await hashOpaqueToken(token);
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS).toISOString();

  await runStatement(
    c.env.DB,
    "DELETE FROM email_verification_tokens WHERE user_id = ? AND used_at IS NULL",
    userId,
  );
  await runStatement(
    c.env.DB,
    `INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at, created_at, used_at)
     VALUES (?, ?, ?, ?, ?, NULL)`,
    crypto.randomUUID(),
    userId,
    tokenHash,
    expiresAt,
    createdAt,
  );

  const verificationUrl = buildVerifyEmailUrl(c, token);
  console.info(`Email verification link for ${userId}: ${verificationUrl}`);
  await sendAccountEmail(c, {
    html: `<p>Verify your email for Melon Meet.</p><p><a href="${verificationUrl}">Verify email</a></p><p>This link expires in 24 hours.</p>`,
    subject: "Verify your Melon Meet email",
    text: `Verify your email for Melon Meet.\n\nOpen this link: ${verificationUrl}\n\nThis link expires in 24 hours.`,
    to: email,
  });

  return {
    devVerificationUrl: localDevLink(c, verificationUrl),
  };
}

async function issuePasswordResetToken(c: Context<AppEnv>, userId: string, email: string) {
  const token = generateOpaqueToken();
  const tokenHash = await hashOpaqueToken(token);
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS).toISOString();

  await runStatement(
    c.env.DB,
    "DELETE FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL",
    userId,
  );
  await runStatement(
    c.env.DB,
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at, used_at)
     VALUES (?, ?, ?, ?, ?, NULL)`,
    crypto.randomUUID(),
    userId,
    tokenHash,
    expiresAt,
    createdAt,
  );

  const resetUrl = buildResetPasswordUrl(c, token);
  console.info(`Password reset link for ${userId}: ${resetUrl}`);
  await sendAccountEmail(c, {
    html: `<p>You requested a password reset for Melon Meet.</p><p><a href="${resetUrl}">Reset password</a></p><p>This link expires in 1 hour.</p>`,
    subject: "Reset your Melon Meet password",
    text: `You requested a password reset for Melon Meet.\n\nOpen this link: ${resetUrl}\n\nThis link expires in 1 hour.`,
    to: email,
  });

  return {
    devResetUrl: localDevLink(c, resetUrl),
  };
}

async function issueEmailChangeToken(c: Context<AppEnv>, userId: string, newEmail: string) {
  const token = generateOpaqueToken();
  const tokenHash = await hashOpaqueToken(token);
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + EMAIL_CHANGE_TTL_MS).toISOString();

  await runStatement(
    c.env.DB,
    "DELETE FROM email_change_tokens WHERE user_id = ? AND used_at IS NULL",
    userId,
  );
  await runStatement(
    c.env.DB,
    `INSERT INTO email_change_tokens (id, user_id, new_email, token_hash, expires_at, created_at, used_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL)`,
    crypto.randomUUID(),
    userId,
    newEmail,
    tokenHash,
    expiresAt,
    createdAt,
  );

  const verificationUrl = buildVerifyEmailChangeUrl(c, token);
  console.info(`Email change link for ${userId}: ${verificationUrl}`);
  await sendAccountEmail(c, {
    html: `<p>Confirm your new email address for Melon Meet.</p><p><a href="${verificationUrl}">Confirm new email</a></p><p>This link expires in 24 hours.</p>`,
    subject: "Confirm your new Melon Meet email",
    text: `Confirm your new email address for Melon Meet.\n\nOpen this link: ${verificationUrl}\n\nThis link expires in 24 hours.`,
    to: newEmail,
  });

  return {
    devVerificationUrl: localDevLink(c, verificationUrl),
  };
}

async function enforceAuthRateLimit(
  c: Context<AppEnv>,
  scope: "auth:login" | "auth:signup",
  email: string,
) {
  const rateLimit = await consumeRateLimit(c.env.DB, {
    identifier: `${getClientAddress(c)}:${email.trim().toLowerCase()}`,
    limit: AUTH_RATE_LIMIT_MAX_ATTEMPTS,
    scope,
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  });

  c.header("X-RateLimit-Limit", String(AUTH_RATE_LIMIT_MAX_ATTEMPTS));
  c.header("X-RateLimit-Remaining", String(rateLimit.remaining));
  c.header("X-RateLimit-Reset", String(rateLimit.retryAfterSeconds));

  if (!rateLimit.allowed) {
    c.header("Retry-After", String(rateLimit.retryAfterSeconds));
    logSecurityEvent(c, "auth_rate_limit_blocked", "warn", {
      email: maskEmailAddress(email),
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      scope,
    });
    return c.json(
      {
        error: "Too many authentication attempts. Please wait a few minutes and try again.",
      },
      429,
    );
  }

  return null;
}

async function enforceWriteRateLimit(
  c: Context<AppEnv>,
  scope: WriteRateLimitScope,
  viewerId: string,
) {
  const config = WRITE_RATE_LIMITS[scope];
  const rateLimit = await consumeRateLimit(c.env.DB, {
    identifier: `${viewerId}:${getClientAddress(c)}`,
    limit: config.limit,
    scope,
    windowMs: config.windowMs,
  });

  c.header("X-RateLimit-Limit", String(config.limit));
  c.header("X-RateLimit-Remaining", String(rateLimit.remaining));
  c.header("X-RateLimit-Reset", String(rateLimit.retryAfterSeconds));

  if (!rateLimit.allowed) {
    c.header("Retry-After", String(rateLimit.retryAfterSeconds));
    logSecurityEvent(c, "write_rate_limit_blocked", "warn", {
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      scope,
      viewerId,
    });
    return c.json(
      {
        error: config.message,
      },
      429,
    );
  }

  return null;
}

function assertTrustedWriteOrigin(c: Context<AppEnv>) {
  const requestOrigin = requestOriginFromHeaders(c);
  if (!requestOrigin) {
    if (!isLocalOrigin(c)) {
      logSecurityEvent(c, "trusted_origin_missing", "warn");
    }
    assertOrThrow(isLocalOrigin(c), 403, "This write request is missing a trusted origin.");
    return;
  }

  if (requestOrigin !== appOrigin(c)) {
    logSecurityEvent(c, "trusted_origin_mismatch", "warn", {
      requestOrigin,
    });
  }
  assertOrThrow(requestOrigin === appOrigin(c), 403, "Cross-site write requests are not allowed.");
}

async function verifySignupTurnstile(c: Context<AppEnv>, token: string | null | undefined) {
  if (!turnstileConfigured(c)) {
    if (!isLocalOrigin(c)) {
      logSecurityEvent(c, "signup_turnstile_not_configured", "warn");
    }
    assertOrThrow(isLocalOrigin(c), 503, "Signup bot protection is not configured.");
    return;
  }

  const normalizedToken = token?.trim();
  if (!normalizedToken) {
    logSecurityEvent(c, "signup_turnstile_missing", "warn");
  }
  assertOrThrow(normalizedToken, 400, "Complete the signup verification challenge and try again.");

  const payload = new URLSearchParams();
  payload.set("secret", c.env.TURNSTILE_SECRET_KEY as string);
  payload.set("response", normalizedToken);
  payload.set("remoteip", getClientAddress(c));

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    body: payload,
    method: "POST",
  });
  assertOrThrow(response.ok, 502, "Signup verification is temporarily unavailable.");

  const result = await response.json() as {
    "error-codes"?: string[];
    success?: boolean;
  };
  if (!result.success) {
    logSecurityEvent(c, "signup_turnstile_failed", "warn", {
      errorCodes: result["error-codes"] ?? [],
    });
  }
  assertOrThrow(result.success, 403, "Complete the signup verification challenge and try again.");
}

async function getGroupRole(
  db: D1Database,
  groupId: string,
  userId: string | null,
): Promise<GroupRole | null> {
  if (!userId) {
    return null;
  }

  const row = await firstRow<{ role: GroupRole }>(
    db,
    "SELECT role FROM app_group_members WHERE group_id = ? AND user_id = ?",
    groupId,
    userId,
  );
  return row?.role ?? null;
}

async function getGroupRecord(db: D1Database, groupId: string) {
  const row = await firstRow<{
    activity_label: string | null;
    archived_at: string | null;
    created_at: string;
    description: string;
    hero_image_url: string | null;
    id: string;
    messenger_url: string | null;
    name: string;
    owner_user_id: string;
    slug: string;
    updated_at: string;
    visibility: GroupVisibility;
  }>(
    db,
    `SELECT id, owner_user_id, name, slug, description, visibility, activity_label, messenger_url, hero_image_url, archived_at, created_at, updated_at
     FROM app_groups
     WHERE id = ?`,
    groupId,
  );
  assertOrThrow(row, 404, "Group not found.");
  assertOrThrow(!row.archived_at, 404, "Group not found.");
  return row;
}

async function assertCanAccessGroup(
  db: D1Database,
  groupId: string,
  userId: string | null,
) {
  const group = await getGroupRecord(db, groupId);
  const viewerRole = await getGroupRole(db, groupId, userId);
  if (group.visibility === "private") {
    assertOrThrow(viewerRole, 403, "This private group is only visible to members.");
  }
  return { group, viewerRole };
}

async function listGroupSummaries(db: D1Database, viewerId: string | null) {
  const rows = await allRows<{
    activity_label: string | null;
    description: string;
    hero_image_url: string | null;
    id: string;
    member_count: number;
    messenger_url: string | null;
    name: string;
    owner_user_id: string;
    public_session_count: number;
    slug: string;
    viewer_role: GroupRole | null;
    visibility: GroupVisibility;
  }>(
    db,
    `SELECT
       g.id,
       g.name,
       g.slug,
       g.description,
       g.visibility,
       g.activity_label,
       g.messenger_url,
       g.hero_image_url,
       g.owner_user_id,
       COALESCE((SELECT COUNT(*) FROM app_group_members gm WHERE gm.group_id = g.id), 0) AS member_count,
       COALESCE((
         SELECT COUNT(*)
         FROM meetings m
         WHERE m.group_id = g.id
           AND m.status = 'active'
           AND m.archived_at IS NULL
       ), 0) AS public_session_count,
       (
         SELECT gm.role
         FROM app_group_members gm
         WHERE gm.group_id = g.id
           AND gm.user_id = ?
         LIMIT 1
       ) AS viewer_role
     FROM app_groups g
     WHERE g.archived_at IS NULL
       AND (
         g.visibility = 'public'
         OR (? IS NOT NULL AND EXISTS (
          SELECT 1
          FROM app_group_members gm
          WHERE gm.group_id = g.id
            AND gm.user_id = ?
        ))
       )
     ORDER BY g.created_at DESC`,
    viewerId,
    viewerId,
    viewerId,
  );

  return rows.map((row) => ({
    activityLabel: row.activity_label,
    description: row.description,
    heroImageUrl: row.hero_image_url,
    id: row.id,
    memberCount: Number(row.member_count),
    messengerUrl: row.messenger_url,
    name: row.name,
    ownerUserId: row.owner_user_id,
    publicSessionCount: Number(row.public_session_count),
    slug: row.slug,
    viewerRole: row.viewer_role,
    visibility: row.visibility,
  }));
}

function mapMeetingRow(row: Record<string, unknown>): MeetingSummary {
  const claimedSpots = Number(row.claimed_spots ?? 0);
  const capacity = Number(row.capacity);
  return {
    activityLabel: (row.activity_label as string | null) ?? null,
    capacity,
    claimedSpots,
    costPerPerson:
      row.cost_per_person === null || row.cost_per_person === undefined
        ? null
        : Number(row.cost_per_person),
    description: (row.description as string | null) ?? null,
    endsAt: String(row.ends_at),
    groupId: String(row.group_id),
    groupName: String(row.group_name),
    groupVisibility: row.group_visibility as "public" | "private",
    heroImageUrl: (row.hero_image_url as string | null) ?? null,
    id: String(row.id),
    latitude: Number(row.latitude),
    locationAddress: String(row.location_address),
    locationName: String(row.location_name),
    longitude: Number(row.longitude),
    openSpots: Math.max(0, capacity - claimedSpots),
    ownerUserId: String(row.owner_user_id),
    pricing: row.pricing as "free" | "paid",
    seriesId: (row.series_id as string | null) ?? null,
    shortName: String(row.short_name ?? row.title),
    startsAt: String(row.starts_at),
    status: row.archived_at ? "archived" : (row.status as "active" | "cancelled"),
    title: String(row.title),
    venueId: (row.venue_id as string | null) ?? null,
    viewerCanEdit: Boolean(row.viewer_can_edit),
    viewerHasClaimed: Boolean(row.viewer_has_claimed),
  };
}

function occurrenceDateFromIso(isoValue: string) {
  return format(new Date(isoValue), "yyyy-MM-dd");
}

async function upsertSeriesOccurrenceOverride(
  db: D1Database,
  occurrence: {
    activityLabel: string | null;
    capacity: number;
    costPerPerson: number | null;
    description: string | null;
    endsAt: string;
    groupId: string;
    heroImageUrl: string | null;
    latitude: number;
    locationAddress: string;
    locationName: string;
    longitude: number;
    ownerUserId: string;
    pricing: "free" | "paid";
    seriesId: string;
    shortName: string;
    startsAt: string;
    title: string;
    venueId: string | null;
  },
) {
  const occurrenceDate = occurrenceDateFromIso(occurrence.startsAt);
  const timestamp = nowIso();
  await runStatement(
    db,
    `INSERT INTO meetings (
       id,
       group_id,
       owner_user_id,
       series_id,
       short_name,
       title,
       description,
       activity_label,
       hero_image_url,
       venue_id,
       location_name,
       location_address,
       latitude,
       longitude,
       pricing,
       cost_per_person,
       capacity,
       starts_at,
       ends_at,
       occurrence_date,
       status,
       created_at,
       updated_at,
       archived_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, NULL)
     ON CONFLICT(series_id, occurrence_date) DO UPDATE SET
       group_id = excluded.group_id,
       owner_user_id = excluded.owner_user_id,
       short_name = excluded.short_name,
       title = excluded.title,
       description = excluded.description,
       activity_label = excluded.activity_label,
       hero_image_url = excluded.hero_image_url,
       venue_id = excluded.venue_id,
       location_name = excluded.location_name,
       location_address = excluded.location_address,
       latitude = excluded.latitude,
       longitude = excluded.longitude,
       pricing = excluded.pricing,
       cost_per_person = excluded.cost_per_person,
       capacity = excluded.capacity,
       starts_at = excluded.starts_at,
       ends_at = excluded.ends_at,
       status = 'active',
       archived_at = NULL,
       updated_at = excluded.updated_at`,
    crypto.randomUUID(),
    occurrence.groupId,
    occurrence.ownerUserId,
    occurrence.seriesId,
    occurrence.shortName,
    occurrence.title,
    occurrence.description,
    occurrence.activityLabel,
    occurrence.heroImageUrl,
    occurrence.venueId,
    occurrence.locationName,
    occurrence.locationAddress,
    occurrence.latitude,
    occurrence.longitude,
    occurrence.pricing,
    occurrence.costPerPerson,
    occurrence.capacity,
    occurrence.startsAt,
    occurrence.endsAt,
    occurrenceDate,
    timestamp,
    timestamp,
  );
}

async function listAccessibleMeetings(
  db: D1Database,
  viewerId: string | null,
  options?: {
    endAt?: string;
    groupId?: string;
    meetingId?: string;
    seriesId?: string;
    venueId?: string;
    north?: number;
    openOnly?: boolean;
    pricing?: "all" | "free" | "paid";
    south?: number;
    startAt?: string;
    west?: number;
    east?: number;
  },
) {
  const rows = await allRows<Record<string, unknown>>(
    db,
    `SELECT
       m.id,
       m.group_id,
       g.name AS group_name,
       g.visibility AS group_visibility,
       m.owner_user_id,
       m.short_name,
       m.title,
       m.description,
       m.activity_label,
       m.hero_image_url,
       m.location_name,
       m.location_address,
       m.latitude,
       m.longitude,
       m.pricing,
       m.cost_per_person,
       m.capacity,
       m.starts_at,
       m.ends_at,
       m.status,
       m.archived_at,
       m.venue_id,
       m.series_id,
       COALESCE((SELECT COUNT(*) FROM meeting_claims mc WHERE mc.meeting_id = m.id), 0) AS claimed_spots,
       CASE WHEN ? IS NOT NULL AND EXISTS (
         SELECT 1
         FROM meeting_claims mc
         WHERE mc.meeting_id = m.id
           AND mc.user_id = ?
       ) THEN 1 ELSE 0 END AS viewer_has_claimed,
       CASE
         WHEN ? IS NOT NULL AND (
           m.owner_user_id = ?
           OR EXISTS (
             SELECT 1
             FROM app_group_members gm
             WHERE gm.group_id = m.group_id
               AND gm.user_id = ?
               AND gm.role IN ('owner', 'admin')
           )
         ) THEN 1 ELSE 0 END AS viewer_can_edit
     FROM meetings m
     JOIN app_groups g ON g.id = m.group_id
     WHERE m.archived_at IS NULL
       AND g.archived_at IS NULL
       AND (? IS NULL OR m.id = ?)
       AND (? IS NULL OR m.group_id = ?)
       AND (? IS NULL OR m.series_id = ?)
       AND (? IS NULL OR m.venue_id = ?)
       AND (? IS NULL OR m.starts_at >= ?)
       AND (? IS NULL OR m.starts_at <= ?)
       AND (? IS NULL OR m.longitude >= ?)
       AND (? IS NULL OR m.longitude <= ?)
       AND (? IS NULL OR m.latitude >= ?)
       AND (? IS NULL OR m.latitude <= ?)
       AND (? = 'all' OR m.pricing = ?)
       AND (
         g.visibility = 'public'
         OR (? IS NOT NULL AND EXISTS (
           SELECT 1
           FROM app_group_members gm
           WHERE gm.group_id = g.id
             AND gm.user_id = ?
         ))
       )
     ORDER BY m.starts_at ASC`,
    viewerId,
    viewerId,
    viewerId,
    viewerId,
    viewerId,
    options?.meetingId ?? null,
    options?.meetingId ?? null,
    options?.groupId ?? null,
    options?.groupId ?? null,
    options?.seriesId ?? null,
    options?.seriesId ?? null,
    options?.venueId ?? null,
    options?.venueId ?? null,
    options?.startAt ?? null,
    options?.startAt ?? null,
    options?.endAt ?? null,
    options?.endAt ?? null,
    options?.west ?? null,
    options?.west ?? null,
    options?.east ?? null,
    options?.east ?? null,
    options?.south ?? null,
    options?.south ?? null,
    options?.north ?? null,
    options?.north ?? null,
    options?.pricing ?? "all",
    options?.pricing ?? "all",
    viewerId,
    viewerId,
  );

  const meetings = rows.map(mapMeetingRow);
  if (!options?.openOnly) {
    return meetings;
  }
  return meetings.filter((meeting) => meeting.status === "active" && meeting.openSpots > 0);
}

async function requireViewer(c: Context<AppEnv>) {
  const viewer = c.get("viewer");
  assertOrThrow(viewer, 401, "Sign in required.");
  return viewer;
}

async function requireVerifiedViewer(c: Context<AppEnv>) {
  const viewer = await requireViewer(c);
  assertOrThrow(viewer.emailVerified, 403, "Verify your email before participating in groups, sessions, and posts.");
  return viewer;
}

async function requestAccountDeletion(db: D1Database, userId: string) {
  const deletionRequestedAt = nowIso();
  const scrubbedPasswordHash = await hashPassword(generateOpaqueToken());

  await revokeAllSessionsForUser(db, userId);
  await runStatement(
    db,
    `UPDATE users
     SET account_status = ?,
         deletion_requested_at = ?,
         deleted_at = NULL,
         email = ?,
         password_hash = ?,
         display_name = ?,
         bio = '',
         home_area = '',
         avatar_url = NULL,
         is_profile_public = 0,
         show_email_publicly = 0,
         playing_level = '',
         email_verified_at = NULL,
         updated_at = ?
     WHERE id = ?`,
    DELETION_PENDING_ACCOUNT_STATUS,
    deletionRequestedAt,
    deletedUserEmail(userId),
    scrubbedPasswordHash,
    DELETED_USER_DISPLAY_NAME,
    deletionRequestedAt,
    userId,
  );
  await runStatement(db, "DELETE FROM email_verification_tokens WHERE user_id = ?", userId);
  await runStatement(db, "DELETE FROM password_reset_tokens WHERE user_id = ?", userId);
  await runStatement(db, "DELETE FROM email_change_tokens WHERE user_id = ?", userId);
  await runStatement(db, "DELETE FROM friend_connections WHERE requester_user_id = ? OR addressee_user_id = ?", userId, userId);
  await runStatement(db, "DELETE FROM meeting_claims WHERE user_id = ?", userId);
  await runStatement(db, "DELETE FROM group_membership_requests WHERE requester_user_id = ?", userId);
  await runStatement(db, "DELETE FROM app_group_members WHERE user_id = ? AND role != 'owner'", userId);
}

export async function finalizePendingAccountDeletions(db: D1Database, referenceTime = new Date()) {
  const deletedAt = referenceTime.toISOString();
  const cutoff = new Date(referenceTime.getTime() - ACCOUNT_DELETION_RETENTION_MS).toISOString();
  const pendingUsers = await allRows<{ id: string }>(
    db,
    `SELECT id
     FROM users
     WHERE account_status = ?
       AND deletion_requested_at IS NOT NULL
       AND deletion_requested_at <= ?
       AND deleted_at IS NULL`,
    DELETION_PENDING_ACCOUNT_STATUS,
    cutoff,
  );

  for (const user of pendingUsers) {
    await runStatement(db, "DELETE FROM group_invite_links WHERE created_by_user_id = ?", user.id);
    await runStatement(db, "DELETE FROM meetings WHERE owner_user_id = ?", user.id);
    await runStatement(db, "DELETE FROM meeting_series WHERE owner_user_id = ?", user.id);
    await runStatement(db, "DELETE FROM app_groups WHERE owner_user_id = ?", user.id);
    await runStatement(db, "DELETE FROM meeting_claims WHERE user_id = ?", user.id);
    await runStatement(db, "DELETE FROM group_membership_requests WHERE requester_user_id = ?", user.id);
    await runStatement(db, "DELETE FROM app_group_members WHERE user_id = ?", user.id);
    await runStatement(
      db,
      "UPDATE users SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
      deletedAt,
      deletedAt,
      user.id,
    );
  }

  return pendingUsers.length;
}

async function getMeetingDetail(
  db: D1Database,
  meetingId: string,
  viewerId: string | null,
) {
  const rawMeeting = await firstRow<{ group_id: string; archived_at: string | null; status: string }>(
    db,
    "SELECT group_id, archived_at, status FROM meetings WHERE id = ?",
    meetingId,
  );
  assertOrThrow(rawMeeting, 404, "Meeting not found.");
  assertOrThrow(!rawMeeting.archived_at, 404, "Meeting not found.");
  await assertCanAccessGroup(db, rawMeeting.group_id, viewerId);
  const [meeting] = await listAccessibleMeetings(db, viewerId, { meetingId });
  assertOrThrow(meeting, 404, "Meeting not found.");
  return meeting;
}

export function createApp() {
  const app = new Hono<AppEnv>();

  app.use("*", async (c, next) => {
    const requestId = crypto.randomUUID();
    c.set("requestId", requestId);
    c.header("x-request-id", requestId);
    await next();
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("Permissions-Policy", "geolocation=(self)");
  });

  app.use("*", async (c, next) => {
    const resolved = await resolveSessionViewer(c.env.DB, readSessionCookie(c));
    c.set("sessionId", resolved?.sessionId ?? null);
    c.set("viewer", resolved?.viewer ? applyModerationRoleToViewer(c.env, resolved.viewer) : null);
    await next();
  });

  app.onError(async (error, c) => {
    if (error instanceof HTTPException) {
      return c.json({ error: error.message }, error.status);
    }

    await reportOperationalError(c.env, error, {
      method: c.req.method,
      path: new URL(c.req.url).pathname,
      requestId: c.get("requestId"),
      sessionId: c.get("sessionId"),
      source: "request",
      status: 500,
      userId: c.get("viewer")?.id ?? null,
    });
    return c.json({ error: "Unexpected server error.", requestId: c.get("requestId") }, 500);
  });

  app.get("/api/health", (c) => c.json({ ok: true }));

  app.get("/api/public-config", (c) =>
    c.json({
      turnstileSiteKey: c.env.TURNSTILE_SITE_KEY ?? null,
    }),
  );

  app.post("/api/auth/signup", zValidator("json", authSchema), async (c) => {
    const { email, password, turnstileToken } = c.req.valid("json");
    const normalizedEmail = email.toLowerCase();
    const limitedResponse = await enforceAuthRateLimit(c, "auth:signup", email);
    if (limitedResponse) {
      return limitedResponse;
    }
    const existing = await firstRow<{ id: string }>(
      c.env.DB,
      "SELECT id FROM users WHERE email = ?",
      normalizedEmail,
    );
    if (existing) {
      logSecurityEvent(c, "signup_existing_email_rejected", "warn", {
        email: maskEmailAddress(normalizedEmail),
      });
    }
    assertOrThrow(!existing, 409, "An account with this email already exists.");
    await verifySignupTurnstile(c, turnstileToken);

    const userId = crypto.randomUUID();
    const createdAt = nowIso();
    const passwordHash = await hashPassword(password);
    await runStatement(
      c.env.DB,
      `INSERT INTO users (
         id, email, password_hash, display_name, bio, home_area, avatar_url,
         is_profile_public, show_email_publicly, playing_level, email_verified_at, created_at, updated_at
      )
       VALUES (?, ?, ?, ?, '', '', NULL, 0, 0, '', NULL, ?, ?)`,
      userId,
      normalizedEmail,
      passwordHash,
      email.split("@")[0],
      createdAt,
      createdAt,
    );

    const session = await createSession(c.env.DB, userId);
    writeSessionCookie(c, session.token, session.expiresAt);
    const { devVerificationUrl } = await issueEmailVerificationToken(c, userId, normalizedEmail);
    logSecurityEvent(c, "signup_succeeded", "info", {
      email: maskEmailAddress(normalizedEmail),
      newUserId: userId,
      verificationRequired: true,
    });

    return c.json({
      user: {
        avatarUrl: null,
        bio: "",
        displayName: email.split("@")[0],
        email: normalizedEmail,
        emailVerified: false,
        homeArea: "",
        id: userId,
        isProfilePublic: false,
        playingLevel: "",
        showEmailPublicly: false,
      },
      verificationRequired: true,
      devVerificationUrl,
    }, 201);
  });

  app.post("/api/auth/login", zValidator("json", authSchema), async (c) => {
    const { email, password } = c.req.valid("json");
    const normalizedEmail = email.toLowerCase();
    const limitedResponse = await enforceAuthRateLimit(c, "auth:login", email);
    if (limitedResponse) {
      return limitedResponse;
    }
    const row = await firstRow<{
      account_status: AccountStatus;
      avatar_url: string | null;
      bio: string;
      display_name: string;
      email: string;
      email_verified_at: string | null;
      home_area: string;
      id: string;
      is_profile_public: number;
      password_hash: string;
      playing_level: string;
      show_email_publicly: number;
    }>(
      c.env.DB,
      `SELECT id, email, email_verified_at, password_hash, display_name, bio, home_area, avatar_url, is_profile_public, playing_level, show_email_publicly, account_status
       FROM users
       WHERE email = ?`,
      normalizedEmail,
    );
    if (!row) {
      logSecurityEvent(c, "login_failed_unknown_email", "warn", {
        email: maskEmailAddress(normalizedEmail),
      });
    }
    assertOrThrow(row, 401, "Invalid email or password.");
    const validPassword = await verifyPassword(password, row.password_hash);
    if (!validPassword) {
      logSecurityEvent(c, "login_failed_bad_password", "warn", {
        email: maskEmailAddress(normalizedEmail),
        attemptedUserId: row.id,
      });
    }
    assertOrThrow(validPassword, 401, "Invalid email or password.");
    if (row.account_status !== ACTIVE_ACCOUNT_STATUS) {
      logSecurityEvent(c, "login_blocked_account_status", "warn", {
        accountStatus: row.account_status,
        attemptedUserId: row.id,
        email: maskEmailAddress(normalizedEmail),
      });
    }
    assertOrThrow(row.account_status === ACTIVE_ACCOUNT_STATUS, 403, "This account is no longer available.");

    const session = await createSession(c.env.DB, row.id);
    writeSessionCookie(c, session.token, session.expiresAt);
    logSecurityEvent(c, "login_succeeded", "info", {
      email: maskEmailAddress(normalizedEmail),
      loggedInUserId: row.id,
      verificationRequired: !Boolean(row.email_verified_at),
    });

    return c.json({
      user: mapViewerSummary(row),
      verificationRequired: !Boolean(row.email_verified_at),
    });
  });

  app.post("/api/auth/verification/resend", async (c) => {
    const viewer = await requireViewer(c);
    assertTrustedWriteOrigin(c);
    if (viewer.emailVerified) {
      return c.json({ ok: true, devVerificationUrl: null });
    }

    const { devVerificationUrl } = await issueEmailVerificationToken(c, viewer.id, viewer.email);
    logSecurityEvent(c, "email_verification_resent", "info", {
      email: maskEmailAddress(viewer.email),
      viewerId: viewer.id,
    });
    return c.json({ ok: true, devVerificationUrl });
  });

  app.post("/api/auth/verify-email", zValidator("json", z.object({ token: z.string().min(1) })), async (c) => {
    const { token } = c.req.valid("json");
    const tokenHash = await hashOpaqueToken(token);
    const verification = await firstRow<{ user_id: string }>(
      c.env.DB,
      `SELECT t.user_id
       FROM email_verification_tokens t
       JOIN users u ON u.id = t.user_id
       WHERE token_hash = ?
         AND t.used_at IS NULL
         AND t.expires_at > ?
         AND u.account_status = ?`,
      tokenHash,
      nowIso(),
      ACTIVE_ACCOUNT_STATUS,
    );
    assertOrThrow(verification, 400, "This verification link is invalid or has expired.");

    const verifiedAt = nowIso();
    await runStatement(
      c.env.DB,
      "UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?",
      verifiedAt,
      verification.user_id,
    );
    await runStatement(
      c.env.DB,
      "UPDATE email_verification_tokens SET used_at = ? WHERE token_hash = ?",
      verifiedAt,
      tokenHash,
    );
    await runStatement(
      c.env.DB,
      "DELETE FROM email_verification_tokens WHERE user_id = ? AND used_at IS NULL",
      verification.user_id,
    );
    logSecurityEvent(c, "email_verified", "info", {
      verifiedUserId: verification.user_id,
    });

    return c.json({ ok: true });
  });

  app.post("/api/auth/forgot-password", zValidator("json", z.object({ email: z.string().email() })), async (c) => {
    const { email } = c.req.valid("json");
    const normalizedEmail = email.toLowerCase();

    const row = await firstRow<{ email: string; id: string }>(
      c.env.DB,
      "SELECT id, email FROM users WHERE email = ? AND account_status = ?",
      normalizedEmail,
      ACTIVE_ACCOUNT_STATUS,
    );

    let devResetUrl: string | null = null;
    if (row) {
      const issued = await issuePasswordResetToken(c, row.id, row.email);
      devResetUrl = issued.devResetUrl;
    }
    logSecurityEvent(c, "password_reset_requested", "info", {
      accountFound: Boolean(row),
      email: maskEmailAddress(normalizedEmail),
    });

    return c.json({
      ok: true,
      devResetUrl,
      message: "If an account exists for that email, a password reset link has been prepared.",
    });
  });

  app.post(
    "/api/auth/reset-password",
    zValidator("json", z.object({ password: z.string().min(8), token: z.string().min(1) })),
    async (c) => {
      const { password, token } = c.req.valid("json");
      const tokenHash = await hashOpaqueToken(token);
      const resetRow = await firstRow<{ user_id: string }>(
        c.env.DB,
        `SELECT t.user_id
         FROM password_reset_tokens t
         JOIN users u ON u.id = t.user_id
         WHERE token_hash = ?
           AND t.used_at IS NULL
           AND t.expires_at > ?
           AND u.account_status = ?`,
        tokenHash,
        nowIso(),
        ACTIVE_ACCOUNT_STATUS,
      );
      assertOrThrow(resetRow, 400, "This password reset link is invalid or has expired.");

      const passwordHash = await hashPassword(password);
      const usedAt = nowIso();
      await runStatement(
        c.env.DB,
        "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
        passwordHash,
        usedAt,
        resetRow.user_id,
      );
      await runStatement(
        c.env.DB,
        "UPDATE password_reset_tokens SET used_at = ? WHERE token_hash = ?",
        usedAt,
        tokenHash,
      );
      await runStatement(
        c.env.DB,
        "DELETE FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL",
        resetRow.user_id,
      );
      await revokeAllSessionsForUser(c.env.DB, resetRow.user_id);
      clearSessionCookie(c);
      logSecurityEvent(c, "password_reset_completed", "info", {
        resetUserId: resetRow.user_id,
      });

      return c.json({ ok: true });
    },
  );

  app.post(
    "/api/auth/change-password",
    zValidator("json", z.object({ currentPassword: z.string().min(1), password: z.string().min(8) })),
    async (c) => {
      const viewer = await requireViewer(c);
      assertTrustedWriteOrigin(c);
      const { currentPassword, password } = c.req.valid("json");

      const row = await firstRow<{ password_hash: string }>(
        c.env.DB,
        "SELECT password_hash FROM users WHERE id = ?",
        viewer.id,
      );
      assertOrThrow(row, 404, "User not found.");
      const validPassword = await verifyPassword(currentPassword, row.password_hash);
      assertOrThrow(validPassword, 401, "Current password is incorrect.");

      const passwordHash = await hashPassword(password);
      const updatedAt = nowIso();
      await runStatement(
        c.env.DB,
        "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
        passwordHash,
        updatedAt,
        viewer.id,
      );
      await revokeOtherSessionsForUser(c.env.DB, viewer.id, c.get("sessionId"));
      logSecurityEvent(c, "password_changed", "info", {
        viewerId: viewer.id,
      });

      return c.json({ ok: true });
    },
  );

  app.post(
    "/api/auth/change-email",
    zValidator("json", z.object({ currentPassword: z.string().min(1), email: z.string().email() })),
    async (c) => {
      const viewer = await requireViewer(c);
      assertTrustedWriteOrigin(c);
      const { currentPassword, email } = c.req.valid("json");
      const normalizedEmail = email.toLowerCase();
      assertOrThrow(normalizedEmail !== viewer.email.toLowerCase(), 400, "This is already your current email.");

      const row = await firstRow<{ password_hash: string }>(
        c.env.DB,
        "SELECT password_hash FROM users WHERE id = ?",
        viewer.id,
      );
      assertOrThrow(row, 404, "User not found.");
      const validPassword = await verifyPassword(currentPassword, row.password_hash);
      assertOrThrow(validPassword, 401, "Current password is incorrect.");

      const existingUser = await firstRow<{ id: string }>(
        c.env.DB,
        "SELECT id FROM users WHERE email = ? AND id != ?",
        normalizedEmail,
        viewer.id,
      );
      assertOrThrow(!existingUser, 409, "An account with this email already exists.");

      const { devVerificationUrl } = await issueEmailChangeToken(c, viewer.id, normalizedEmail);
      logSecurityEvent(c, "email_change_requested", "info", {
        newEmail: maskEmailAddress(normalizedEmail),
        viewerId: viewer.id,
      });
      return c.json({ ok: true, devVerificationUrl });
    },
  );

  app.post("/api/auth/logout-other-sessions", async (c) => {
    const viewer = await requireViewer(c);
    assertTrustedWriteOrigin(c);
    await revokeOtherSessionsForUser(c.env.DB, viewer.id, c.get("sessionId"));
    await writeAuditLogEvent(c.env.DB, {
      action: "other_sessions_revoked",
      actorUserId: viewer.id,
      metadata: { requestId: c.get("requestId") },
      summary: "User revoked all other active sessions.",
      targetId: viewer.id,
      targetType: "user",
    });
    logSecurityEvent(c, "other_sessions_revoked", "info", {
      viewerId: viewer.id,
    });
    return c.json({ ok: true });
  });

  app.post("/api/auth/verify-email-change", zValidator("json", z.object({ token: z.string().min(1) })), async (c) => {
    const { token } = c.req.valid("json");
    const tokenHash = await hashOpaqueToken(token);
    const changeRow = await firstRow<{ new_email: string; user_id: string }>(
      c.env.DB,
      `SELECT t.user_id, t.new_email
       FROM email_change_tokens t
       JOIN users u ON u.id = t.user_id
       WHERE token_hash = ?
         AND t.used_at IS NULL
         AND t.expires_at > ?
         AND u.account_status = ?`,
      tokenHash,
      nowIso(),
      ACTIVE_ACCOUNT_STATUS,
    );
    assertOrThrow(changeRow, 400, "This email change link is invalid or has expired.");

    const existingUser = await firstRow<{ id: string }>(
      c.env.DB,
      "SELECT id FROM users WHERE email = ? AND id != ?",
      changeRow.new_email,
      changeRow.user_id,
    );
    assertOrThrow(!existingUser, 409, "That email is no longer available.");

    const updatedAt = nowIso();
    await runStatement(
      c.env.DB,
      "UPDATE users SET email = ?, email_verified_at = ?, updated_at = ? WHERE id = ?",
      changeRow.new_email,
      updatedAt,
      updatedAt,
      changeRow.user_id,
    );
    await runStatement(
      c.env.DB,
      "UPDATE email_change_tokens SET used_at = ? WHERE token_hash = ?",
      updatedAt,
      tokenHash,
    );
    await runStatement(
      c.env.DB,
      "DELETE FROM email_change_tokens WHERE user_id = ? AND used_at IS NULL",
      changeRow.user_id,
    );
    await revokeOtherSessionsForUser(c.env.DB, changeRow.user_id, c.get("sessionId"));
    logSecurityEvent(c, "email_change_completed", "info", {
      changedUserId: changeRow.user_id,
      newEmail: maskEmailAddress(changeRow.new_email),
    });

    return c.json({ ok: true, email: changeRow.new_email });
  });

  app.post("/api/auth/logout", async (c) => {
    const viewerId = c.get("viewer")?.id ?? null;
    assertTrustedWriteOrigin(c);
    await revokeSessionByToken(c.env.DB, readSessionCookie(c));
    clearSessionCookie(c);
    logSecurityEvent(c, "logout", "info", {
      viewerId,
    });
    return c.json({ ok: true });
  });

  app.post("/api/reports", zValidator("json", reportCreateSchema), async (c) => {
    const viewer = await requireViewer(c);
    assertTrustedWriteOrigin(c);
    const { note, reason, targetId, targetType } = c.req.valid("json");
    await assertReportTargetExists(c.env.DB, viewer.id, targetType, targetId);

    const existingOpenReport = await firstRow<{ id: string }>(
      c.env.DB,
      `SELECT id
       FROM content_reports
       WHERE reporter_user_id = ?
         AND target_type = ?
         AND target_id = ?
         AND status IN ('open', 'triaged')
       LIMIT 1`,
      viewer.id,
      targetType,
      targetId,
    );
    assertOrThrow(!existingOpenReport, 409, "You already have an open report for this item.");

    const timestamp = nowIso();
    await runStatement(
      c.env.DB,
      `INSERT INTO content_reports (
         id, reporter_user_id, target_type, target_id, reason, note, status, internal_notes, resolution, assignee_user_id, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, 'open', NULL, NULL, NULL, ?, ?)`,
      crypto.randomUUID(),
      viewer.id,
      targetType,
      targetId,
      reason,
      normalizeOptionalText(note ?? null),
      timestamp,
      timestamp,
    );
    logSecurityEvent(c, "content_report_created", "info", {
      reason,
      reporterUserId: viewer.id,
      targetId,
      targetType,
    });
    return c.json({ ok: true }, 201);
  });

  app.get("/api/moderation/reports", zValidator("query", moderationReportListQuerySchema), async (c) => {
    const viewer = await requireModerationViewer(c);
    const { status } = c.req.valid("query");
    const reports = await allRows<ModerationReportRow>(
      c.env.DB,
      `SELECT
         cr.id,
         cr.target_type,
         cr.target_id,
         cr.reason,
         cr.note,
         cr.status,
         cr.internal_notes,
         cr.resolution,
         cr.created_at,
         cr.updated_at,
         reporter.id AS reporter_id,
         reporter.email AS reporter_email,
         reporter.email_verified_at AS reporter_email_verified_at,
         reporter.display_name AS reporter_display_name,
         reporter.bio AS reporter_bio,
         reporter.home_area AS reporter_home_area,
         reporter.playing_level AS reporter_playing_level,
         reporter.avatar_url AS reporter_avatar_url,
         reporter.is_profile_public AS reporter_is_profile_public,
         reporter.show_email_publicly AS reporter_show_email_publicly,
         assignee.id AS assignee_id,
         assignee.email AS assignee_email,
         assignee.email_verified_at AS assignee_email_verified_at,
         assignee.display_name AS assignee_display_name,
         assignee.bio AS assignee_bio,
         assignee.home_area AS assignee_home_area,
         assignee.playing_level AS assignee_playing_level,
         assignee.avatar_url AS assignee_avatar_url,
         assignee.is_profile_public AS assignee_is_profile_public,
         assignee.show_email_publicly AS assignee_show_email_publicly
       FROM content_reports cr
       JOIN users reporter ON reporter.id = cr.reporter_user_id
       LEFT JOIN users assignee ON assignee.id = cr.assignee_user_id
       ${status === "all" ? "" : "WHERE cr.status = ?"}
       ORDER BY
         CASE cr.status
           WHEN 'open' THEN 1
           WHEN 'triaged' THEN 2
           WHEN 'action_taken' THEN 3
           ELSE 4
         END,
         cr.created_at DESC
       LIMIT 200`,
      ...(status === "all" ? [] : [status]),
    );

    return c.json({
      reports: await Promise.all(reports.map((row) => mapModerationReportSummary(c.env.DB, c.env, row))),
      viewerModerationRole: viewer.moderationRole,
    });
  });

  app.patch("/api/moderation/reports/:id", zValidator("json", moderationReportUpdateSchema), async (c) => {
    const viewer = await requireModerationViewer(c);
    assertTrustedWriteOrigin(c);
    const reportId = c.req.param("id");
    const updates = c.req.valid("json");
    const existing = await firstRow<{ id: string; status: ModerationReportStatus }>(
      c.env.DB,
      "SELECT id, status FROM content_reports WHERE id = ?",
      reportId,
    );
    assertOrThrow(existing, 404, "Report not found.");

    if (updates.assigneeUserId) {
      const assignee = await firstRow<{ email: string; id: string }>(
        c.env.DB,
        "SELECT id, email FROM users WHERE id = ?",
        updates.assigneeUserId,
      );
      assertOrThrow(assignee, 400, "Assignee not found.");
      assertOrThrow(Boolean(moderationRoleForEmail(c.env, assignee.email)), 400, "Assignee must have moderation access.");
    }

    const assignments: string[] = [];
    const params: Array<string | null> = [];

    if (updates.status !== undefined) {
      assignments.push("status = ?");
      params.push(updates.status);
    }
    if (updates.internalNotes !== undefined) {
      assignments.push("internal_notes = ?");
      params.push(normalizeOptionalText(updates.internalNotes ?? null));
    }
    if (updates.resolution !== undefined) {
      assignments.push("resolution = ?");
      params.push(normalizeOptionalText(updates.resolution ?? null));
    }
    if (updates.assigneeUserId !== undefined) {
      assignments.push("assignee_user_id = ?");
      params.push(updates.assigneeUserId ?? null);
    }

    const updatedAt = nowIso();
    assignments.push("updated_at = ?");
    params.push(updatedAt);
    params.push(reportId);

    await runStatement(
      c.env.DB,
      `UPDATE content_reports
       SET ${assignments.join(", ")}
       WHERE id = ?`,
      ...params,
    );

    const updatedReport = await firstRow<ModerationReportRow>(
      c.env.DB,
      `SELECT
         cr.id,
         cr.target_type,
         cr.target_id,
         cr.reason,
         cr.note,
         cr.status,
         cr.internal_notes,
         cr.resolution,
         cr.created_at,
         cr.updated_at,
         reporter.id AS reporter_id,
         reporter.email AS reporter_email,
         reporter.email_verified_at AS reporter_email_verified_at,
         reporter.display_name AS reporter_display_name,
         reporter.bio AS reporter_bio,
         reporter.home_area AS reporter_home_area,
         reporter.playing_level AS reporter_playing_level,
         reporter.avatar_url AS reporter_avatar_url,
         reporter.is_profile_public AS reporter_is_profile_public,
         reporter.show_email_publicly AS reporter_show_email_publicly,
         assignee.id AS assignee_id,
         assignee.email AS assignee_email,
         assignee.email_verified_at AS assignee_email_verified_at,
         assignee.display_name AS assignee_display_name,
         assignee.bio AS assignee_bio,
         assignee.home_area AS assignee_home_area,
         assignee.playing_level AS assignee_playing_level,
         assignee.avatar_url AS assignee_avatar_url,
         assignee.is_profile_public AS assignee_is_profile_public,
         assignee.show_email_publicly AS assignee_show_email_publicly
       FROM content_reports cr
       JOIN users reporter ON reporter.id = cr.reporter_user_id
       LEFT JOIN users assignee ON assignee.id = cr.assignee_user_id
       WHERE cr.id = ?`,
      reportId,
    );
    assertOrThrow(updatedReport, 404, "Report not found.");

    logSecurityEvent(c, "moderation_report_updated", "info", {
      actorUserId: viewer.id,
      assigneeUserId: updates.assigneeUserId ?? undefined,
      reportId,
      status: updates.status ?? existing.status,
    });
    await writeAuditLogEvent(c.env.DB, {
      action: "moderation_report_updated",
      actorUserId: viewer.id,
      metadata: {
        assigneeUserId: updates.assigneeUserId ?? null,
        reportId,
        requestId: c.get("requestId"),
        resolution: updates.resolution ?? null,
        status: updates.status ?? existing.status,
      },
      summary: "Operator updated a moderation report.",
      targetId: reportId,
      targetType: "moderation_report",
    });

    return c.json({
      report: await mapModerationReportSummary(c.env.DB, c.env, updatedReport),
    });
  });

  app.post("/api/moderation/reports/:id/actions", zValidator("json", moderationActionSchema), async (c) => {
    const viewer = await requireModerationViewer(c, "admin");
    assertTrustedWriteOrigin(c);
    const reportId = c.req.param("id");
    const { action } = c.req.valid("json");
    const report = await firstRow<{
      assignee_user_id: string | null;
      id: string;
      internal_notes: string | null;
      reporter_user_id: string;
      target_id: string;
      target_type: ReportTargetType;
    }>(
      c.env.DB,
      `SELECT id, reporter_user_id, target_type, target_id, assignee_user_id, internal_notes
       FROM content_reports
       WHERE id = ?`,
      reportId,
    );
    assertOrThrow(report, 404, "Report not found.");

    await executeModerationAction(c.env.DB, report, action);

    const resolution = moderationActionResolution(action);
    const internalNotes = [report.internal_notes, `[${new Date().toISOString()}] ${resolution}`]
      .filter((entry) => entry && entry.trim().length > 0)
      .join("\n");

    await runStatement(
      c.env.DB,
      `UPDATE content_reports
       SET status = 'action_taken',
           resolution = COALESCE(NULLIF(resolution, ''), ?),
           internal_notes = ?,
           assignee_user_id = COALESCE(assignee_user_id, ?),
           updated_at = ?
       WHERE id = ?`,
      resolution,
      internalNotes,
      viewer.id,
      nowIso(),
      reportId,
    );

    const updatedReport = await firstRow<ModerationReportRow>(
      c.env.DB,
      `SELECT
         cr.id,
         cr.target_type,
         cr.target_id,
         cr.reason,
         cr.note,
         cr.status,
         cr.internal_notes,
         cr.resolution,
         cr.created_at,
         cr.updated_at,
         reporter.id AS reporter_id,
         reporter.email AS reporter_email,
         reporter.email_verified_at AS reporter_email_verified_at,
         reporter.display_name AS reporter_display_name,
         reporter.bio AS reporter_bio,
         reporter.home_area AS reporter_home_area,
         reporter.playing_level AS reporter_playing_level,
         reporter.avatar_url AS reporter_avatar_url,
         reporter.is_profile_public AS reporter_is_profile_public,
         reporter.show_email_publicly AS reporter_show_email_publicly,
         assignee.id AS assignee_id,
         assignee.email AS assignee_email,
         assignee.email_verified_at AS assignee_email_verified_at,
         assignee.display_name AS assignee_display_name,
         assignee.bio AS assignee_bio,
         assignee.home_area AS assignee_home_area,
         assignee.playing_level AS assignee_playing_level,
         assignee.avatar_url AS assignee_avatar_url,
         assignee.is_profile_public AS assignee_is_profile_public,
         assignee.show_email_publicly AS assignee_show_email_publicly
       FROM content_reports cr
       JOIN users reporter ON reporter.id = cr.reporter_user_id
       LEFT JOIN users assignee ON assignee.id = cr.assignee_user_id
       WHERE cr.id = ?`,
      reportId,
    );
    assertOrThrow(updatedReport, 404, "Report not found.");

    logSecurityEvent(c, "moderation_admin_action_taken", "warn", {
      action,
      actorUserId: viewer.id,
      reportId,
      targetId: report.target_id,
      targetType: report.target_type,
    });
    await writeAuditLogEvent(c.env.DB, {
      action: "moderation_admin_action_taken",
      actorUserId: viewer.id,
      metadata: {
        moderationAction: action,
        reportId,
        requestId: c.get("requestId"),
        targetId: report.target_id,
        targetType: report.target_type,
      },
      summary: moderationActionResolution(action),
      targetId: report.target_id,
      targetType: report.target_type,
    });

    return c.json({
      report: await mapModerationReportSummary(c.env.DB, c.env, updatedReport),
    });
  });

  app.get("/api/me", async (c) => {
    const viewer = c.get("viewer");
    if (!viewer) {
      return c.json({ viewer: null, groups: [], friends: [] });
    }

    const groups = await listGroupSummaries(c.env.DB, viewer.id);
    const friends = await allRows<{
      connection_id: string;
      direction: "incoming" | "outgoing";
      status: "pending" | "accepted";
      user_avatar_url: string | null;
      user_bio: string;
      user_display_name: string;
      user_email: string;
      user_email_verified_at: string | null;
      user_home_area: string;
      user_id: string;
      user_is_profile_public: number;
      user_show_email_publicly: number;
    }>(
      c.env.DB,
      `SELECT
         fc.id AS connection_id,
         fc.status,
         CASE WHEN fc.requester_user_id = ? THEN 'outgoing' ELSE 'incoming' END AS direction,
         u.id AS user_id,
         u.email AS user_email,
         u.email_verified_at AS user_email_verified_at,
         u.display_name AS user_display_name,
         u.bio AS user_bio,
         u.home_area AS user_home_area,
         u.avatar_url AS user_avatar_url,
         u.is_profile_public AS user_is_profile_public,
         u.show_email_publicly AS user_show_email_publicly
       FROM friend_connections fc
       JOIN users u
         ON u.id = CASE
           WHEN fc.requester_user_id = ? THEN fc.addressee_user_id
           ELSE fc.requester_user_id
         END
       WHERE fc.requester_user_id = ?
          OR fc.addressee_user_id = ?
       ORDER BY fc.updated_at DESC`,
      viewer.id,
      viewer.id,
      viewer.id,
      viewer.id,
    );

    return c.json({
      friends: friends.map((friend) => ({
        direction: friend.direction,
        id: friend.connection_id,
        status: friend.status,
        user: mapViewerSummary({
          avatar_url: friend.user_avatar_url,
          bio: friend.user_bio,
          display_name: friend.user_display_name,
          email: friend.user_email,
          email_verified_at: friend.user_email_verified_at,
          home_area: friend.user_home_area,
          id: friend.user_id,
          is_profile_public: friend.user_is_profile_public,
          show_email_publicly: friend.user_show_email_publicly,
        }),
      })),
      groups,
      viewer,
    });
  });

  app.get("/api/profiles/:id", async (c) => {
    const row = await firstRow<ViewerRow>(
      c.env.DB,
      `SELECT id, email, email_verified_at, display_name, bio, home_area, avatar_url, is_profile_public, show_email_publicly
             , playing_level
       FROM users
       WHERE id = ?`,
      c.req.param("id"),
    );
    assertOrThrow(row, 404, "Profile not found.");

    const viewer = c.get("viewer");
    const profile = mapViewerSummary(row);
    const canViewProfile = viewer?.id === row.id || profile.isProfilePublic;
    const friendship = viewer
      ? await firstRow<{ id: string; status: "pending" | "accepted" }>(
        c.env.DB,
        `SELECT id, status
         FROM friend_connections
         WHERE (requester_user_id = ? AND addressee_user_id = ?)
            OR (requester_user_id = ? AND addressee_user_id = ?)`,
        viewer.id,
        row.id,
        row.id,
        viewer.id,
      )
      : null;

    const memberships = canViewProfile
      ? await allRows<{
        group_id: string;
        group_name: string;
        group_slug: string;
        role: GroupRole;
      }>(
        c.env.DB,
        `SELECT gm.group_id, g.name AS group_name, g.slug AS group_slug, gm.role
         FROM app_group_members gm
         JOIN app_groups g ON g.id = gm.group_id
         WHERE gm.user_id = ?
           AND g.archived_at IS NULL
           AND (g.visibility = 'public' OR ? = ?)
         ORDER BY g.name ASC`,
        row.id,
        viewer?.id ?? "",
        row.id,
      )
      : [];

    const accessibleMeetings = canViewProfile
      ? await listAccessibleMeetings(c.env.DB, viewer?.id ?? null, {})
      : [];

    const claimedMeetingIds = canViewProfile
      ? new Set(
        (
          await allRows<{ meeting_id: string }>(
            c.env.DB,
            `SELECT meeting_id
             FROM meeting_claims
             WHERE user_id = ?`,
            row.id,
          )
        ).map((entry) => entry.meeting_id),
      )
      : new Set<string>();

    const responsibleMeetingIds = canViewProfile
      ? new Set(
        (
          await allRows<{ id: string }>(
            c.env.DB,
            `SELECT DISTINCT m.id
             FROM meetings m
             LEFT JOIN app_group_members gm
               ON gm.group_id = m.group_id
              AND gm.user_id = ?
             WHERE m.archived_at IS NULL
               AND (m.owner_user_id = ? OR gm.role IN ('owner', 'admin'))`,
            row.id,
            row.id,
          )
        ).map((entry) => entry.id),
      )
      : new Set<string>();

    const attending = accessibleMeetings.filter((meeting) => claimedMeetingIds.has(meeting.id));
    const responsible = accessibleMeetings.filter(
      (meeting) => responsibleMeetingIds.has(meeting.id) && !claimedMeetingIds.has(meeting.id),
    );

    return c.json({
      friendship,
      memberships: memberships.map((membership) => ({
        id: membership.group_id,
        name: membership.group_name,
        role: membership.role,
        slug: membership.group_slug,
      })),
      profile: canViewProfile
        ? {
          ...profile,
          email:
            viewer?.id === row.id || profile.showEmailPublicly
              ? profile.email
              : "",
        }
        : {
          ...profile,
          bio: "",
          email: "",
          homeArea: "",
          playingLevel: "",
        },
      profileIsPrivate: !canViewProfile,
      attending,
      responsible,
    });
  });

  app.patch("/api/profiles/:id", zValidator("json", profileUpdateSchema), async (c) => {
    const viewer = await requireViewer(c);
    assertTrustedWriteOrigin(c);
    assertOrThrow(viewer.id === c.req.param("id"), 403, "You can only edit your own profile.");
    const input = c.req.valid("json");
    const updatedAt = nowIso();
    await runStatement(
      c.env.DB,
      `UPDATE users
       SET display_name = ?,
           bio = ?,
           home_area = ?,
           avatar_url = ?,
           is_profile_public = ?,
           playing_level = ?,
           show_email_publicly = ?,
           updated_at = ?
       WHERE id = ?`,
      input.displayName,
      input.bio ?? "",
      input.homeArea ?? "",
      normalizeOptionalText(input.avatarUrl ?? null),
      input.isProfilePublic ? 1 : 0,
      input.playingLevel ?? "",
      input.showEmailPublicly ? 1 : 0,
      updatedAt,
      viewer.id,
    );

    return c.json({
      profile: {
        ...viewer,
        avatarUrl: normalizeOptionalText(input.avatarUrl ?? null),
        bio: input.bio ?? "",
        displayName: input.displayName,
        homeArea: input.homeArea ?? "",
        isProfilePublic: input.isProfilePublic,
        playingLevel: input.playingLevel ?? "",
        showEmailPublicly: input.showEmailPublicly,
      },
    });
  });

  app.delete("/api/profiles/:id", async (c) => {
    const viewer = await requireViewer(c);
    assertTrustedWriteOrigin(c);
    assertOrThrow(viewer.id === c.req.param("id"), 403, "You can only delete your own profile.");
    await requestAccountDeletion(c.env.DB, viewer.id);
    await writeAuditLogEvent(c.env.DB, {
      action: "account_deletion_requested",
      actorUserId: viewer.id,
      metadata: { requestId: c.get("requestId") },
      summary: "User requested account deletion.",
      targetId: viewer.id,
      targetType: "user",
    });
    clearSessionCookie(c);
    logSecurityEvent(c, "account_deletion_requested", "warn", {
      viewerId: viewer.id,
    });
    return c.json({ ok: true });
  });

  app.post("/api/friends/requests", zValidator("json", friendRequestSchema), async (c) => {
    const viewer = await requireVerifiedViewer(c);
    assertTrustedWriteOrigin(c);
    const limitedResponse = await enforceWriteRateLimit(c, "write:friend-request", viewer.id);
    if (limitedResponse) {
      return limitedResponse;
    }
    const input = c.req.valid("json");
    const target = input.targetUserId
      ? await firstRow<{ id: string }>(
        c.env.DB,
        "SELECT id FROM users WHERE id = ?",
        input.targetUserId,
      )
      : await firstRow<{ id: string }>(
      c.env.DB,
      "SELECT id FROM users WHERE email = ?",
      input.targetEmail?.toLowerCase() ?? "",
      );
    assertOrThrow(target, 404, "Target user not found.");
    assertOrThrow(target.id !== viewer.id, 400, "You cannot add yourself.");
    const existingConnection = await firstRow<{
      addressee_user_id: string;
      requester_user_id: string;
      status: "accepted" | "pending";
    }>(
      c.env.DB,
      `SELECT requester_user_id, addressee_user_id, status
       FROM friend_connections
       WHERE (requester_user_id = ? AND addressee_user_id = ?)
          OR (requester_user_id = ? AND addressee_user_id = ?)`,
      viewer.id,
      target.id,
      target.id,
      viewer.id,
    );
    assertOrThrow(existingConnection?.status !== "accepted", 409, "You are already connected with this user.");
    assertOrThrow(
      !(existingConnection?.status === "pending" && existingConnection.requester_user_id === viewer.id),
      409,
      "A friend request is already pending.",
    );
    assertOrThrow(
      !(existingConnection?.status === "pending" && existingConnection.requester_user_id === target.id),
      409,
      "This user already sent you a friend request.",
    );

    const createdAt = nowIso();
    await runStatement(
      c.env.DB,
      `INSERT OR REPLACE INTO friend_connections (
         id, requester_user_id, addressee_user_id, status, created_at, updated_at
       ) VALUES (?, ?, ?, 'pending', ?, ?)`,
      crypto.randomUUID(),
      viewer.id,
      target.id,
      createdAt,
      createdAt,
    );
    logSecurityEvent(c, "friend_request_created", "info", {
      requesterUserId: viewer.id,
      targetUserId: target.id,
    });

    return c.json({ ok: true }, 201);
  });

  app.post("/api/friends/requests/:id/accept", async (c) => {
    const viewer = await requireVerifiedViewer(c);
    assertTrustedWriteOrigin(c);
    const request = await firstRow<{ addressee_user_id: string; id: string }>(
      c.env.DB,
      "SELECT id, addressee_user_id FROM friend_connections WHERE id = ? AND status = 'pending'",
      c.req.param("id"),
    );
    assertOrThrow(request, 404, "Friend request not found.");
    assertOrThrow(request.addressee_user_id === viewer.id, 403, "Only the recipient can accept this request.");
    await runStatement(
      c.env.DB,
      "UPDATE friend_connections SET status = 'accepted', updated_at = ? WHERE id = ?",
      nowIso(),
      request.id,
    );
    return c.json({ ok: true });
  });

  app.delete("/api/friends/:id", async (c) => {
    const viewer = await requireVerifiedViewer(c);
    assertTrustedWriteOrigin(c);
    await runStatement(
      c.env.DB,
      `DELETE FROM friend_connections
       WHERE id = ?
         AND (requester_user_id = ? OR addressee_user_id = ?)`,
      c.req.param("id"),
      viewer.id,
      viewer.id,
    );
    return c.json({ ok: true });
  });

  app.get("/api/groups", async (c) => {
    return c.json({ groups: await listGroupSummaries(c.env.DB, c.get("viewer")?.id ?? null) });
  });

  app.post("/api/groups", zValidator("json", groupCreateSchema), async (c) => {
    const viewer = await requireVerifiedViewer(c);
    assertTrustedWriteOrigin(c);
    const limitedResponse = await enforceWriteRateLimit(c, "write:group-create", viewer.id);
    if (limitedResponse) {
      return limitedResponse;
    }
    const input = c.req.valid("json");
    const createdAt = nowIso();
    const groupId = crypto.randomUUID();

    await runStatement(
      c.env.DB,
      `INSERT INTO app_groups (
         id, owner_user_id, name, slug, description, visibility, activity_label, messenger_url, hero_image_url, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      groupId,
      viewer.id,
      input.name,
      input.slug,
      input.description,
      input.visibility,
      normalizeOptionalText(input.activityLabel ?? null),
      normalizeOptionalText(input.messengerUrl ?? null),
      normalizeOptionalText(input.heroImageUrl ?? null),
      createdAt,
      createdAt,
    );
    await runStatement(
      c.env.DB,
      `INSERT INTO app_group_members (id, group_id, user_id, role, created_at)
       VALUES (?, ?, ?, 'owner', ?)`,
      crypto.randomUUID(),
      groupId,
      viewer.id,
      createdAt,
    );

    return c.json({ groupId }, 201);
  });

  app.get("/api/groups/:id", async (c) => {
    const viewer = c.get("viewer");
    const { group, viewerRole } = await assertCanAccessGroup(
      c.env.DB,
      c.req.param("id"),
      viewer?.id ?? null,
    );
    await ensureSeriesCoverage(c.env.DB);

    const members = await allRows<{
      avatar_url: string | null;
      bio: string;
      display_name: string;
      email: string;
      home_area: string;
      role: GroupRole;
      user_id: string;
    }>(
      c.env.DB,
      `SELECT
         gm.role,
         u.id AS user_id,
         u.email,
         u.display_name,
         u.bio,
         u.home_area,
         u.avatar_url
       FROM app_group_members gm
       JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = ?
       ORDER BY CASE gm.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END, u.display_name`,
      group.id,
    );

    const posts = await allRows<{
      author_id: string;
      author_avatar_url: string | null;
      author_bio: string;
      author_display_name: string;
      author_email: string;
      author_home_area: string;
      content: string;
      created_at: string;
      id: string;
    }>(
      c.env.DB,
      `SELECT
         gp.id,
         gp.content,
         gp.created_at,
         u.id AS author_id,
         u.email AS author_email,
         u.display_name AS author_display_name,
         u.bio AS author_bio,
         u.home_area AS author_home_area,
         u.avatar_url AS author_avatar_url
       FROM group_posts gp
       JOIN users u ON u.id = gp.author_user_id
       WHERE gp.group_id = ?
       ORDER BY gp.created_at DESC
       LIMIT 50`,
      group.id,
    );

    const meetings = await listAccessibleMeetings(c.env.DB, viewer?.id ?? null, {
      groupId: group.id,
    });
    const inviteLinks = viewerRole === "owner"
      ? await allRows<{ code: string; created_at: string; expires_at: string | null; id: string }>(
        c.env.DB,
        `SELECT id, code, created_at, expires_at
         FROM group_invite_links
         WHERE group_id = ?
         ORDER BY created_at DESC`,
        group.id,
      )
      : [];

    return c.json({
      group: {
        activityLabel: group.activity_label,
        createdAt: group.created_at,
        description: group.description,
        heroImageUrl: group.hero_image_url,
        id: group.id,
        messengerUrl: group.messenger_url,
        name: group.name,
        ownerUserId: group.owner_user_id,
        slug: group.slug,
        updatedAt: group.updated_at,
        viewerCanCreateMeeting:
          group.visibility === "private"
            ? Boolean(viewerRole)
            : viewerRole === "owner" || viewerRole === "admin",
        viewerCanEditGroup: viewerRole === "owner" || viewerRole === "admin",
        viewerCanManageMembers: viewerRole === "owner",
        viewerRole,
        visibility: group.visibility,
      },
      inviteLinks,
      meetings,
      members: members.map((member) => ({
        role: member.role,
        user: mapViewerSummary({
          avatar_url: member.avatar_url,
          bio: member.bio,
          display_name: member.display_name,
          email: member.email,
          home_area: member.home_area,
          id: member.user_id,
          is_profile_public: 0,
          show_email_publicly: 0,
        }),
      })),
      posts: posts.map((post) => ({
        author: mapViewerSummary({
          avatar_url: post.author_avatar_url,
          bio: post.author_bio,
          display_name: post.author_display_name,
          email: post.author_email,
          home_area: post.author_home_area,
          id: post.author_id,
          is_profile_public: 0,
          show_email_publicly: 0,
        }),
        content: post.content,
        createdAt: post.created_at,
        id: post.id,
      })),
    });
  });

  app.patch("/api/groups/:id", zValidator("json", groupUpdateSchema), async (c) => {
    const viewer = await requireVerifiedViewer(c);
    assertTrustedWriteOrigin(c);
    const { group, viewerRole } = await assertCanAccessGroup(c.env.DB, c.req.param("id"), viewer.id);
    assertOrThrow(viewerRole === "owner" || viewerRole === "admin", 403, "Only group owners or admins can edit the group.");
    const limitedResponse = await enforceWriteRateLimit(c, "write:group-update", viewer.id);
    if (limitedResponse) {
      return limitedResponse;
    }
    const input = c.req.valid("json");

    await runStatement(
      c.env.DB,
      `UPDATE app_groups
       SET name = COALESCE(?, name),
           slug = COALESCE(?, slug),
           description = COALESCE(?, description),
           visibility = COALESCE(?, visibility),
           activity_label = COALESCE(?, activity_label),
           messenger_url = CASE WHEN ? THEN messenger_url ELSE ? END,
           hero_image_url = COALESCE(?, hero_image_url),
           updated_at = ?
       WHERE id = ?`,
      input.name ?? null,
      input.slug ?? null,
      input.description ?? null,
      input.visibility ?? null,
      input.activityLabel === undefined ? null : normalizeOptionalText(input.activityLabel ?? null),
      input.messengerUrl === undefined ? 1 : 0,
      input.messengerUrl === undefined ? null : normalizeOptionalText(input.messengerUrl ?? null),
      input.heroImageUrl === undefined ? null : normalizeOptionalText(input.heroImageUrl ?? null),
      nowIso(),
      group.id,
    );

    return c.json({ ok: true });
  });

  app.delete("/api/groups/:id", async (c) => {
    const viewer = await requireVerifiedViewer(c);
    assertTrustedWriteOrigin(c);
    const { group, viewerRole } = await assertCanAccessGroup(c.env.DB, c.req.param("id"), viewer.id);
    assertOrThrow(viewerRole === "owner" || viewerRole === "admin", 403, "Only group owners or admins can archive the group.");
    await runStatement(
      c.env.DB,
      "UPDATE app_groups SET archived_at = ?, updated_at = ? WHERE id = ?",
      nowIso(),
      nowIso(),
      group.id,
    );
    await writeAuditLogEvent(c.env.DB, {
      action: "group_archived",
      actorUserId: viewer.id,
      metadata: { requestId: c.get("requestId") },
      summary: "Group was archived.",
      targetId: group.id,
      targetType: "group",
    });
    return c.json({ ok: true });
  });

  app.post("/api/groups/:id/join", async (c) => {
    const viewer = await requireVerifiedViewer(c);
    assertTrustedWriteOrigin(c);
    const group = await getGroupRecord(c.env.DB, c.req.param("id"));
    assertOrThrow(group.visibility === "public", 403, "Private groups require an invite link.");
    await runStatement(
      c.env.DB,
      `INSERT OR IGNORE INTO app_group_members (id, group_id, user_id, role, created_at)
       VALUES (?, ?, ?, 'member', ?)`,
      crypto.randomUUID(),
      group.id,
      viewer.id,
      nowIso(),
    );
    return c.json({ ok: true });
  });

  app.delete("/api/groups/:id/membership", async (c) => {
    const viewer = await requireVerifiedViewer(c);
    assertTrustedWriteOrigin(c);
    const { group, viewerRole } = await assertCanAccessGroup(c.env.DB, c.req.param("id"), viewer.id);
    assertOrThrow(Boolean(viewerRole), 400, "You are not a member of this group.");
    assertOrThrow(viewerRole !== "owner", 400, "Group owners cannot leave their own group.");
    await runStatement(
      c.env.DB,
      "DELETE FROM app_group_members WHERE group_id = ? AND user_id = ?",
      group.id,
      viewer.id,
    );
    await writeAuditLogEvent(c.env.DB, {
      action: "group_membership_left",
      actorUserId: viewer.id,
      metadata: {
        requestId: c.get("requestId"),
        role: viewerRole,
      },
      summary: "Member left a group.",
      targetId: group.id,
      targetType: "group",
    });
    logSecurityEvent(c, "group_membership_left", "info", {
      groupId: group.id,
      memberUserId: viewer.id,
      role: viewerRole,
    });
    return c.json({ ok: true });
  });

  app.post(
    "/api/groups/:id/membership-requests",
    zValidator("json", z.object({ note: z.string().trim().max(300).optional().nullable() })),
    async (c) => {
      const viewer = await requireVerifiedViewer(c);
      assertTrustedWriteOrigin(c);
      const group = await getGroupRecord(c.env.DB, c.req.param("id"));
      const existingRole = await getGroupRole(c.env.DB, group.id, viewer.id);
      assertOrThrow(!existingRole, 400, "You are already a member of this group.");
      const limitedResponse = await enforceWriteRateLimit(c, "write:group-membership-request", viewer.id);
      if (limitedResponse) {
        return limitedResponse;
      }
      const existingRequest = await firstRow<{ status: "approved" | "pending" | "rejected"; updated_at: string }>(
        c.env.DB,
        `SELECT status, updated_at
         FROM group_membership_requests
         WHERE group_id = ?
           AND requester_user_id = ?`,
        group.id,
        viewer.id,
      );
      assertOrThrow(existingRequest?.status !== "pending", 409, "Your membership request is already pending.");
      assertOrThrow(
        !existingRequest || !isRecentIsoTimestamp(existingRequest.updated_at, MEMBERSHIP_REQUEST_COOLDOWN_MS),
        429,
        "Please wait before requesting access to this group again.",
      );
      await runStatement(
        c.env.DB,
        `INSERT INTO group_membership_requests (
           id, group_id, requester_user_id, note, status, created_at, updated_at
         ) VALUES (?, ?, ?, ?, 'pending', ?, ?)
         ON CONFLICT(group_id, requester_user_id)
         DO UPDATE SET note = excluded.note, status = 'pending', updated_at = excluded.updated_at`,
        crypto.randomUUID(),
        group.id,
        viewer.id,
        normalizeOptionalText(c.req.valid("json").note ?? null),
        nowIso(),
        nowIso(),
      );
      logSecurityEvent(c, "group_membership_requested", "info", {
        groupId: group.id,
        requesterUserId: viewer.id,
      });
      return c.json({ ok: true }, 201);
    },
  );

  app.get("/api/groups/:id/membership-requests", async (c) => {
    const viewer = await requireViewer(c);
    const { group, viewerRole } = await assertCanAccessGroup(c.env.DB, c.req.param("id"), viewer.id);
    assertOrThrow(viewerRole === "owner" || viewerRole === "admin", 403, "Only group owners or admins can review requests.");
    const requests = await allRows<{
      created_at: string;
      id: string;
      note: string | null;
      requester_avatar_url: string | null;
      requester_bio: string;
      requester_display_name: string;
      requester_email: string;
      requester_home_area: string;
      requester_id: string;
      status: "pending" | "approved" | "rejected";
    }>(
      c.env.DB,
      `SELECT
         r.id,
         r.note,
         r.status,
         r.created_at,
         u.id AS requester_id,
         u.email AS requester_email,
         u.display_name AS requester_display_name,
         u.bio AS requester_bio,
         u.home_area AS requester_home_area,
         u.avatar_url AS requester_avatar_url
       FROM group_membership_requests r
       JOIN users u ON u.id = r.requester_user_id
       WHERE r.group_id = ?
       ORDER BY r.created_at DESC`,
      group.id,
    );
    return c.json({
      requests: requests.map((request) => ({
        createdAt: request.created_at,
        groupId: group.id,
        id: request.id,
        note: request.note,
        requester: mapViewerSummary({
          avatar_url: request.requester_avatar_url,
          bio: request.requester_bio,
          display_name: request.requester_display_name,
          email: request.requester_email,
          home_area: request.requester_home_area,
          id: request.requester_id,
          is_profile_public: 0,
          show_email_publicly: 0,
        }),
        status: request.status,
      })),
    });
  });

  app.post("/api/groups/:id/membership-requests/:requestId/approve", async (c) => {
    const viewer = await requireVerifiedViewer(c);
    assertTrustedWriteOrigin(c);
    const { group, viewerRole } = await assertCanAccessGroup(c.env.DB, c.req.param("id"), viewer.id);
    assertOrThrow(viewerRole === "owner" || viewerRole === "admin", 403, "Only group owners or admins can review requests.");
    const request = await firstRow<{ requester_user_id: string }>(
      c.env.DB,
      `SELECT requester_user_id
       FROM group_membership_requests
       WHERE id = ? AND group_id = ? AND status = 'pending'`,
      c.req.param("requestId"),
      group.id,
    );
    assertOrThrow(request, 404, "Membership request not found.");
    await runStatement(
      c.env.DB,
      `INSERT OR IGNORE INTO app_group_members (id, group_id, user_id, role, created_at)
       VALUES (?, ?, ?, 'member', ?)`,
      crypto.randomUUID(),
      group.id,
      request.requester_user_id,
      nowIso(),
    );
    await runStatement(
      c.env.DB,
      `UPDATE group_membership_requests
       SET status = 'approved', updated_at = ?
       WHERE id = ?`,
      nowIso(),
      c.req.param("requestId"),
    );
    return c.json({ ok: true });
  });

  app.post("/api/groups/:id/membership-requests/:requestId/reject", async (c) => {
    const viewer = await requireVerifiedViewer(c);
    assertTrustedWriteOrigin(c);
    const { group, viewerRole } = await assertCanAccessGroup(c.env.DB, c.req.param("id"), viewer.id);
    assertOrThrow(viewerRole === "owner" || viewerRole === "admin", 403, "Only group owners or admins can review requests.");
    await runStatement(
      c.env.DB,
      `UPDATE group_membership_requests
       SET status = 'rejected', updated_at = ?
       WHERE id = ? AND group_id = ?`,
      nowIso(),
      c.req.param("requestId"),
      group.id,
    );
    return c.json({ ok: true });
  });

  app.post("/api/groups/:id/invite-links", async (c) => {
    const viewer = await requireVerifiedViewer(c);
    assertTrustedWriteOrigin(c);
    const { group, viewerRole } = await assertCanAccessGroup(c.env.DB, c.req.param("id"), viewer.id);
    assertOrThrow(group.visibility === "private", 400, "Invite links are only needed for private groups.");
    assertOrThrow(viewerRole === "owner", 403, "Only the group owner can create invite links.");
    const limitedResponse = await enforceWriteRateLimit(c, "write:group-invite-link-create", viewer.id);
    if (limitedResponse) {
      return limitedResponse;
    }
    const latestInvite = await firstRow<{ created_at: string }>(
      c.env.DB,
      `SELECT created_at
       FROM group_invite_links
       WHERE group_id = ?
         AND created_by_user_id = ?
         AND (expires_at IS NULL OR expires_at > ?)
       ORDER BY created_at DESC
       LIMIT 1`,
      group.id,
      viewer.id,
      nowIso(),
    );
    assertOrThrow(
      !latestInvite || !isRecentIsoTimestamp(latestInvite.created_at, INVITE_LINK_COOLDOWN_MS),
      429,
      "Please wait a few minutes before creating another invite link for this group.",
    );

    const code = makeInviteCode();
    await runStatement(
      c.env.DB,
      `INSERT INTO group_invite_links (id, group_id, code, created_by_user_id, expires_at, created_at)
       VALUES (?, ?, ?, ?, NULL, ?)`,
      crypto.randomUUID(),
      group.id,
      code,
      viewer.id,
      nowIso(),
    );
    logSecurityEvent(c, "group_invite_link_created", "info", {
      creatorUserId: viewer.id,
      groupId: group.id,
    });
    await writeAuditLogEvent(c.env.DB, {
      action: "group_invite_link_created",
      actorUserId: viewer.id,
      metadata: {
        code,
        requestId: c.get("requestId"),
      },
      summary: "Group invite link was created.",
      targetId: group.id,
      targetType: "group",
    });
    return c.json({ code }, 201);
  });

  app.post("/api/groups/invite-links/:code/accept", async (c) => {
    const viewer = await requireVerifiedViewer(c);
    assertTrustedWriteOrigin(c);
    const invite = await firstRow<{ group_id: string; id: string }>(
      c.env.DB,
      `SELECT id, group_id
       FROM group_invite_links
       WHERE code = ?
         AND (expires_at IS NULL OR expires_at > ?)`,
      c.req.param("code"),
      nowIso(),
    );
    assertOrThrow(invite, 404, "Invite link not found.");
    await runStatement(
      c.env.DB,
      `INSERT OR IGNORE INTO app_group_members (id, group_id, user_id, role, created_at)
       VALUES (?, ?, ?, 'member', ?)`,
      crypto.randomUUID(),
      invite.group_id,
      viewer.id,
      nowIso(),
    );
    return c.json({ ok: true });
  });

  app.patch("/api/groups/:id/members/:userId", zValidator("json", roleUpdateSchema), async (c) => {
    const viewer = await requireVerifiedViewer(c);
    assertTrustedWriteOrigin(c);
    const { group, viewerRole } = await assertCanAccessGroup(c.env.DB, c.req.param("id"), viewer.id);
    assertOrThrow(viewerRole === "owner", 403, "Only the group owner can change member roles.");
    assertOrThrow(c.req.param("userId") !== group.owner_user_id, 400, "The group owner role cannot be reassigned in v1.");
    await runStatement(
      c.env.DB,
      `UPDATE app_group_members
       SET role = ?
       WHERE group_id = ?
         AND user_id = ?`,
      c.req.valid("json").role,
      group.id,
      c.req.param("userId"),
    );
    await writeAuditLogEvent(c.env.DB, {
      action: "group_member_role_changed",
      actorUserId: viewer.id,
      metadata: {
        newRole: c.req.valid("json").role,
        requestId: c.get("requestId"),
        targetUserId: c.req.param("userId"),
      },
      summary: "Group member role was changed.",
      targetId: group.id,
      targetType: "group",
    });
    return c.json({ ok: true });
  });

  app.get("/api/groups/:id/posts", async (c) => {
    const viewer = await requireViewer(c);
    await assertCanAccessGroup(c.env.DB, c.req.param("id"), viewer.id);
    const posts = await allRows<{ content: string; created_at: string; display_name: string; id: string }>(
      c.env.DB,
      `SELECT gp.id, gp.content, gp.created_at, u.display_name
       FROM group_posts gp
       JOIN users u ON u.id = gp.author_user_id
       WHERE gp.group_id = ?
       ORDER BY gp.created_at DESC`,
      c.req.param("id"),
    );
    return c.json({ posts });
  });

  app.post("/api/groups/:id/posts", zValidator("json", groupPostSchema), async (c) => {
    const viewer = await requireVerifiedViewer(c);
    assertTrustedWriteOrigin(c);
    await assertCanAccessGroup(c.env.DB, c.req.param("id"), viewer.id);
    const limitedResponse = await enforceWriteRateLimit(c, "write:group-post", viewer.id);
    if (limitedResponse) {
      return limitedResponse;
    }
    const content = c.req.valid("json").content;
    await assertPostNotSpammy(c.env.DB, {
      authorUserId: viewer.id,
      content,
      scopeColumn: "group_id",
      scopeId: c.req.param("id"),
      scopeLabel: "group",
      table: "group_posts",
    });
    await runStatement(
      c.env.DB,
      `INSERT INTO group_posts (id, group_id, author_user_id, content, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      crypto.randomUUID(),
      c.req.param("id"),
      viewer.id,
      content,
      nowIso(),
    );
    return c.json({ ok: true }, 201);
  });

  app.get("/api/venues", async (c) => {
    const venues = await allRows<VenueRow>(
      c.env.DB,
      `SELECT id, name, address, description, pricing, latitude, longitude, source_url, booking_url, opening_hours_text, hero_image_url,
              website_url, google_maps_url, court_count_total, indoor_court_count, outdoor_court_count, access_type, environment,
              seasonality_text, facts_json, amenities_json, image_gallery_json, source_urls_json, duplicate_notes, researched_at
       FROM venues
       ORDER BY name ASC`,
    );
    return c.json({
      venues: venues.map(mapVenueSummary),
    });
  });

  app.get("/api/venues/:id", async (c) => {
    await ensureSeriesCoverage(c.env.DB);
    const viewerId = c.get("viewer")?.id ?? null;

    const venue = await firstRow<VenueRow>(
      c.env.DB,
      `SELECT id, name, address, description, pricing, latitude, longitude, source_url, booking_url, opening_hours_text, hero_image_url,
              website_url, google_maps_url, court_count_total, indoor_court_count, outdoor_court_count, access_type, environment,
              seasonality_text, facts_json, amenities_json, image_gallery_json, source_urls_json, duplicate_notes, researched_at
       FROM venues
       WHERE id = ?`,
      c.req.param("id"),
    );
    assertOrThrow(venue, 404, "Venue not found.");

    const meetings = await listAccessibleMeetings(c.env.DB, viewerId, {
      venueId: venue.id,
    });

    return c.json({
      meetings,
      venue: mapVenueSummary(venue),
    });
  });

  app.get("/api/map", zValidator("query", mapQuerySchema), async (c) => {
    await ensureSeriesCoverage(c.env.DB);
    const query = c.req.valid("query");
    const viewerId = c.get("viewer")?.id ?? null;

    const venues = await allRows<VenueRow>(
      c.env.DB,
      `SELECT id, name, address, description, pricing, latitude, longitude, source_url, booking_url, opening_hours_text, hero_image_url,
              website_url, google_maps_url, court_count_total, indoor_court_count, outdoor_court_count, access_type, environment,
              seasonality_text, facts_json, amenities_json, image_gallery_json, source_urls_json, duplicate_notes, researched_at
       FROM venues
       WHERE longitude BETWEEN ? AND ?
         AND latitude BETWEEN ? AND ?
         AND (? = 'all' OR pricing = ?)
       ORDER BY name ASC`,
      query.west,
      query.east,
      query.south,
      query.north,
      query.pricing,
      query.pricing,
    );

    const meetings = await listAccessibleMeetings(c.env.DB, viewerId, {
      east: query.east,
      endAt: query.endAt,
      north: query.north,
      openOnly: query.openOnly,
      pricing: query.pricing,
      south: query.south,
      startAt: query.startAt,
      west: query.west,
    });

    return c.json({
      meetings,
      venues: venues.map(mapVenueSummary),
    });
  });

  app.get("/api/meetings", async (c) => {
    await ensureSeriesCoverage(c.env.DB);
    const groupId = c.req.query("groupId") ?? undefined;
    const meetings = await listAccessibleMeetings(c.env.DB, c.get("viewer")?.id ?? null, { groupId });
    return c.json({ meetings });
  });

  app.post("/api/meetings", zValidator("json", meetingCreateSchema), async (c) => {
    const viewer = await requireVerifiedViewer(c);
    assertTrustedWriteOrigin(c);
    const input = c.req.valid("json");
    const { group, viewerRole } = await assertCanAccessGroup(c.env.DB, input.groupId, viewer.id);

    const canCreate =
      group.visibility === "private"
        ? Boolean(viewerRole)
        : viewerRole === "owner" || viewerRole === "admin";
    assertOrThrow(canCreate, 403, "You do not have permission to create meetings in this group.");
    const limitedResponse = await enforceWriteRateLimit(c, "write:meeting-create", viewer.id);
    if (limitedResponse) {
      return limitedResponse;
    }

    const createdAt = nowIso();
    const groupActivity = normalizeOptionalText(input.activityLabel ?? null);

    if (input.recurrence.type === "weekly") {
      const seriesId = crypto.randomUUID();
      const timeZone = input.recurrence.timezone || c.env.DEFAULT_TIMEZONE;
      const startDate = isoToLocalDate(input.startsAt, timeZone);
      const startTimeLocal = isoToLocalTime(input.startsAt, timeZone);
      const weekday = isoToWeekday(input.startsAt, timeZone);

      await runStatement(
        c.env.DB,
        `INSERT INTO meeting_series (
           id, group_id, owner_user_id, short_name, title, description, activity_label, hero_image_url, venue_id, location_name,
           location_address, latitude, longitude, pricing, cost_per_person, capacity, timezone, weekday, start_time_local,
           duration_minutes, start_date, until_date, status, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
        seriesId,
        group.id,
        viewer.id,
        input.shortName,
        input.title,
        normalizeOptionalText(input.description ?? null),
        groupActivity,
        normalizeOptionalText(input.heroImageUrl ?? null),
        normalizeOptionalText(input.venueId ?? null),
        input.locationName,
        input.locationAddress,
        input.latitude,
        input.longitude,
        input.pricing,
        input.costPerPerson ?? null,
        input.capacity,
        timeZone,
        weekday,
        startTimeLocal,
        durationMinutes(input.startsAt, input.endsAt),
        startDate,
        input.recurrence.untilDate ?? null,
        createdAt,
        createdAt,
      );

      await ensureSeriesCoverage(c.env.DB, {
        fromDate: startDate,
        horizon: input.recurrence.untilDate ?? horizonDate(),
        seriesId,
      });

      return c.json({ seriesId }, 201);
    }

    const meetingId = crypto.randomUUID();
    await runStatement(
      c.env.DB,
      `INSERT INTO meetings (
         id, group_id, owner_user_id, series_id, short_name, title, description, activity_label, hero_image_url, venue_id,
         location_name, location_address, latitude, longitude, pricing, cost_per_person, capacity, starts_at, ends_at,
         occurrence_date, status, created_at, updated_at
       ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      meetingId,
      group.id,
      viewer.id,
      input.shortName,
      input.title,
      normalizeOptionalText(input.description ?? null),
      groupActivity,
      normalizeOptionalText(input.heroImageUrl ?? null),
      normalizeOptionalText(input.venueId ?? null),
      input.locationName,
      input.locationAddress,
      input.latitude,
      input.longitude,
      input.pricing,
      input.costPerPerson ?? null,
      input.capacity,
      input.startsAt,
      input.endsAt,
      format(new Date(input.startsAt), "yyyy-MM-dd"),
      createdAt,
      createdAt,
    );

    return c.json({ meetingId }, 201);
  });

  app.get("/api/meetings/:id", async (c) => {
    await ensureSeriesCoverage(c.env.DB);
    const viewer = c.get("viewer");
    const meeting = await getMeetingDetail(c.env.DB, c.req.param("id"), viewer?.id ?? null);
    const groupRole = await getGroupRole(c.env.DB, meeting.groupId, viewer?.id ?? null);
    const seriesMeetings = meeting.seriesId
      ? await listAccessibleMeetings(c.env.DB, viewer?.id ?? null, { seriesId: meeting.seriesId })
      : [];

    const claims = await allRows<{
      avatar_url: string | null;
      bio: string;
      display_name: string;
      email: string;
      home_area: string;
      playing_level: string;
      user_id: string;
    }>(
      c.env.DB,
      `SELECT u.id AS user_id, u.email, u.display_name, u.bio, u.home_area, u.playing_level, u.avatar_url
       FROM meeting_claims mc
       JOIN users u ON u.id = mc.user_id
       WHERE mc.meeting_id = ?
       ORDER BY mc.created_at ASC`,
      meeting.id,
    );

    const posts = await allRows<{
      author_id: string;
      author_avatar_url: string | null;
      author_bio: string;
      author_display_name: string;
      author_email: string;
      author_home_area: string;
      content: string;
      created_at: string;
      id: string;
    }>(
      c.env.DB,
      `SELECT
         mp.id,
         mp.content,
         mp.created_at,
         u.id AS author_id,
         u.email AS author_email,
         u.display_name AS author_display_name,
         u.bio AS author_bio,
         u.home_area AS author_home_area,
         u.avatar_url AS author_avatar_url
       FROM meeting_posts mp
       JOIN users u ON u.id = mp.author_user_id
       WHERE mp.meeting_id = ?
       ORDER BY mp.created_at DESC
       LIMIT 50`,
      meeting.id,
    );

    return c.json({
      claims: claims.map((claim) => ({
        ...mapViewerSummary({
          avatar_url: claim.avatar_url,
          bio: claim.bio,
          display_name: claim.display_name,
          email: claim.email,
          home_area: claim.home_area,
          id: claim.user_id,
          is_profile_public: 0,
          playing_level: claim.playing_level,
          show_email_publicly: 0,
        }),
      })),
      meeting,
      posts: posts.map((post) => ({
        author: mapViewerSummary({
          avatar_url: post.author_avatar_url,
          bio: post.author_bio,
          display_name: post.author_display_name,
          email: post.author_email,
          home_area: post.author_home_area,
          id: post.author_id,
          is_profile_public: 0,
          show_email_publicly: 0,
        }),
        content: post.content,
        createdAt: post.created_at,
        id: post.id,
      })),
      seriesMeetings,
      viewerGroupRole: groupRole,
    });
  });

  app.patch("/api/meetings/:id", zValidator("json", meetingUpdateSchema), async (c) => {
    const viewer = await requireVerifiedViewer(c);
    assertTrustedWriteOrigin(c);
    const meetingId = c.req.param("id");
    const input = c.req.valid("json");

    const meetingRow = await firstRow<{
      activity_label: string | null;
      capacity: number;
      description: string | null;
      ends_at: string;
      group_id: string;
      hero_image_url: string | null;
      id: string;
      latitude: number;
      location_address: string;
      location_name: string;
      longitude: number;
      owner_user_id: string;
      pricing: "free" | "paid";
      cost_per_person: number | null;
      series_id: string | null;
      short_name: string;
      starts_at: string;
      title: string;
      venue_id: string | null;
    }>(
      c.env.DB,
      `SELECT id, group_id, owner_user_id, series_id, short_name, title, description, activity_label, hero_image_url, venue_id,
              location_name, location_address, latitude, longitude, pricing, cost_per_person, capacity, starts_at, ends_at
       FROM meetings
       WHERE id = ?`,
      meetingId,
    );
    assertOrThrow(meetingRow, 404, "Meeting not found.");
    assertOrThrow(meetingRow.owner_user_id === viewer.id, 403, "Only the meeting owner can edit this meeting.");
    const limitedResponse = await enforceWriteRateLimit(c, "write:meeting-update", viewer.id);
    if (limitedResponse) {
      return limitedResponse;
    }

    const nextStartsAt = input.startsAt ?? meetingRow.starts_at;
    const nextEndsAt = input.endsAt ?? meetingRow.ends_at;
    assertOrThrow(new Date(nextEndsAt).getTime() > new Date(nextStartsAt).getTime(), 400, "End time must be after start time.");

    if (meetingRow.series_id && input.applyToSeries) {
      const series = await firstRow<{ timezone: string; until_date: string | null }>(
        c.env.DB,
        "SELECT timezone, until_date FROM meeting_series WHERE id = ?",
        meetingRow.series_id,
      );
      assertOrThrow(series, 404, "Meeting series not found.");
      const timezone = series.timezone;
      const submittedSeriesDates =
        input.seriesDates && input.seriesDates.length > 0
          ? [...input.seriesDates].sort(
              (left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
            )
          : null;
      const seriesStartAt = submittedSeriesDates?.[0]?.startsAt ?? nextStartsAt;
      const seriesEndAt = submittedSeriesDates?.[0]?.endsAt ?? nextEndsAt;
      const localStartDate = isoToLocalDate(seriesStartAt, timezone);
      const localStartTime = isoToLocalTime(seriesStartAt, timezone);
      const weekday = getDay(fromZonedTime(`${localStartDate}T${localStartTime}:00`, timezone));
      const untilDate = submittedSeriesDates?.length
        ? isoToLocalDate(submittedSeriesDates[submittedSeriesDates.length - 1].startsAt, timezone)
        : series.until_date ?? horizonDate();

      await runStatement(
        c.env.DB,
        `UPDATE meeting_series
         SET short_name = ?,
             title = ?,
             description = ?,
             activity_label = ?,
             hero_image_url = ?,
             venue_id = ?,
             location_name = ?,
             location_address = ?,
             latitude = ?,
             longitude = ?,
             pricing = ?,
             cost_per_person = ?,
             capacity = ?,
             weekday = ?,
             start_time_local = ?,
             duration_minutes = ?,
             start_date = ?,
             until_date = ?,
             updated_at = ?
         WHERE id = ?`,
        input.shortName ?? meetingRow.short_name,
        input.title ?? meetingRow.title,
        input.description === undefined ? meetingRow.description : normalizeOptionalText(input.description),
        input.activityLabel === undefined ? meetingRow.activity_label : normalizeOptionalText(input.activityLabel),
        input.heroImageUrl === undefined ? meetingRow.hero_image_url : normalizeOptionalText(input.heroImageUrl),
        input.venueId === undefined ? meetingRow.venue_id : normalizeOptionalText(input.venueId),
        input.locationName ?? meetingRow.location_name,
        input.locationAddress ?? meetingRow.location_address,
        input.latitude ?? meetingRow.latitude,
        input.longitude ?? meetingRow.longitude,
        input.pricing ?? meetingRow.pricing,
        input.costPerPerson === undefined ? meetingRow.cost_per_person : input.costPerPerson,
        input.capacity ?? meetingRow.capacity,
        weekday,
        localStartTime,
        durationMinutes(seriesStartAt, seriesEndAt),
        localStartDate,
        untilDate,
        nowIso(),
        meetingRow.series_id,
      );

      if (submittedSeriesDates) {
        const submittedDates = new Set(submittedSeriesDates.map((entry) => occurrenceDateFromIso(entry.startsAt)));
        const timestamp = nowIso();

        for (const slot of submittedSeriesDates) {
          await upsertSeriesOccurrenceOverride(c.env.DB, {
            activityLabel: input.activityLabel === undefined ? meetingRow.activity_label : normalizeOptionalText(input.activityLabel),
            capacity: input.capacity ?? meetingRow.capacity,
            costPerPerson: input.costPerPerson === undefined ? meetingRow.cost_per_person : input.costPerPerson,
            description: input.description === undefined ? meetingRow.description : normalizeOptionalText(input.description),
            endsAt: slot.endsAt,
            groupId: meetingRow.group_id,
            heroImageUrl: input.heroImageUrl === undefined ? meetingRow.hero_image_url : normalizeOptionalText(input.heroImageUrl),
            latitude: input.latitude ?? meetingRow.latitude,
            locationAddress: input.locationAddress ?? meetingRow.location_address,
            locationName: input.locationName ?? meetingRow.location_name,
            longitude: input.longitude ?? meetingRow.longitude,
            ownerUserId: meetingRow.owner_user_id,
            pricing: input.pricing ?? meetingRow.pricing,
            seriesId: meetingRow.series_id,
            shortName: input.shortName ?? meetingRow.short_name,
            startsAt: slot.startsAt,
            title: input.title ?? meetingRow.title,
            venueId: input.venueId === undefined ? meetingRow.venue_id : normalizeOptionalText(input.venueId),
          });
        }

        const existingSeriesMeetings = await allRows<{ occurrence_date: string; id: string }>(
          c.env.DB,
          `SELECT id, occurrence_date
           FROM meetings
           WHERE series_id = ?
             AND archived_at IS NULL`,
          meetingRow.series_id,
        );

        const datesToArchive = existingSeriesMeetings
          .map((item) => item.occurrence_date)
          .filter((occurrenceDate) => !submittedDates.has(occurrenceDate));

        if (datesToArchive.length > 0) {
          await runStatement(
            c.env.DB,
            `UPDATE meetings
             SET status = 'cancelled',
                 archived_at = ?,
                 updated_at = ?
             WHERE series_id = ?
               AND archived_at IS NULL
               AND occurrence_date IN (${datesToArchive.map(() => "?").join(", ")})`,
            timestamp,
            timestamp,
            meetingRow.series_id,
            ...datesToArchive,
          );
        }

        return c.json({ ok: true });
      }

      await ensureSeriesCoverage(c.env.DB, {
        fromDate: localStartDate,
        horizon: untilDate,
        seriesId: meetingRow.series_id,
      });

      return c.json({ ok: true });
    }

    await runStatement(
      c.env.DB,
      `UPDATE meetings
       SET short_name = ?,
           title = ?,
           description = ?,
           activity_label = ?,
           hero_image_url = ?,
           venue_id = ?,
           location_name = ?,
           location_address = ?,
           latitude = ?,
           longitude = ?,
           pricing = ?,
           cost_per_person = ?,
           capacity = ?,
           starts_at = ?,
           ends_at = ?,
           occurrence_date = ?,
           updated_at = ?
       WHERE id = ?`,
      input.shortName ?? meetingRow.short_name,
      input.title ?? meetingRow.title,
      input.description === undefined ? meetingRow.description : normalizeOptionalText(input.description),
      input.activityLabel === undefined ? meetingRow.activity_label : normalizeOptionalText(input.activityLabel),
      input.heroImageUrl === undefined ? meetingRow.hero_image_url : normalizeOptionalText(input.heroImageUrl),
      input.venueId === undefined ? meetingRow.venue_id : normalizeOptionalText(input.venueId),
      input.locationName ?? meetingRow.location_name,
      input.locationAddress ?? meetingRow.location_address,
      input.latitude ?? meetingRow.latitude,
      input.longitude ?? meetingRow.longitude,
      input.pricing ?? meetingRow.pricing,
      input.costPerPerson === undefined ? meetingRow.cost_per_person : input.costPerPerson,
      input.capacity ?? meetingRow.capacity,
      nextStartsAt,
      nextEndsAt,
      format(new Date(nextStartsAt), "yyyy-MM-dd"),
      nowIso(),
      meetingId,
    );

    return c.json({ ok: true });
  });

  app.post("/api/meetings/:id/claim", async (c) => {
    const viewer = await requireVerifiedViewer(c);
    assertTrustedWriteOrigin(c);
    const meeting = await getMeetingDetail(c.env.DB, c.req.param("id"), viewer.id);
    assertOrThrow(meeting.status === "active", 400, "Cancelled meetings cannot be claimed.");
    assertOrThrow(new Date(meeting.endsAt).getTime() > Date.now(), 400, "Past meetings cannot be claimed.");
    assertOrThrow(meeting.openSpots > 0 || meeting.viewerHasClaimed, 409, "This meeting is already full.");

    await runStatement(
      c.env.DB,
      `INSERT OR IGNORE INTO meeting_claims (id, meeting_id, user_id, created_at)
       VALUES (?, ?, ?, ?)`,
      crypto.randomUUID(),
      meeting.id,
      viewer.id,
      nowIso(),
    );
    return c.json({ ok: true });
  });

  app.delete("/api/meetings/:id/claim", async (c) => {
    const viewer = await requireVerifiedViewer(c);
    assertTrustedWriteOrigin(c);
    await getMeetingDetail(c.env.DB, c.req.param("id"), viewer.id);
    await runStatement(
      c.env.DB,
      "DELETE FROM meeting_claims WHERE meeting_id = ? AND user_id = ?",
      c.req.param("id"),
      viewer.id,
    );
    return c.json({ ok: true });
  });

  app.post("/api/meetings/:id/cancel", async (c) => {
    const viewer = await requireVerifiedViewer(c);
    assertTrustedWriteOrigin(c);
    const meeting = await firstRow<{ group_id: string; owner_user_id: string }>(
      c.env.DB,
      "SELECT group_id, owner_user_id FROM meetings WHERE id = ?",
      c.req.param("id"),
    );
    assertOrThrow(meeting, 404, "Meeting not found.");
    const viewerRole = await getGroupRole(c.env.DB, meeting.group_id, viewer.id);
    const canManage = meeting.owner_user_id === viewer.id || viewerRole === "owner" || viewerRole === "admin";
    assertOrThrow(canManage, 403, "Only the meeting owner or group admins can cancel this meeting.");
    await runStatement(
      c.env.DB,
      "UPDATE meetings SET status = 'cancelled', updated_at = ? WHERE id = ?",
      nowIso(),
      c.req.param("id"),
    );
    await writeAuditLogEvent(c.env.DB, {
      action: "meeting_cancelled",
      actorUserId: viewer.id,
      metadata: { requestId: c.get("requestId") },
      summary: "Session was cancelled.",
      targetId: c.req.param("id"),
      targetType: "meeting",
    });
    return c.json({ ok: true });
  });

  app.post("/api/meetings/:id/revive", async (c) => {
    const viewer = await requireVerifiedViewer(c);
    assertTrustedWriteOrigin(c);
    const meeting = await firstRow<{ group_id: string; owner_user_id: string }>(
      c.env.DB,
      "SELECT group_id, owner_user_id FROM meetings WHERE id = ?",
      c.req.param("id"),
    );
    assertOrThrow(meeting, 404, "Meeting not found.");
    const viewerRole = await getGroupRole(c.env.DB, meeting.group_id, viewer.id);
    const canManage = meeting.owner_user_id === viewer.id || viewerRole === "owner" || viewerRole === "admin";
    assertOrThrow(canManage, 403, "Only the meeting owner or group admins can revive this meeting.");
    await runStatement(
      c.env.DB,
      "UPDATE meetings SET status = 'active', updated_at = ? WHERE id = ?",
      nowIso(),
      c.req.param("id"),
    );
    await writeAuditLogEvent(c.env.DB, {
      action: "meeting_revived",
      actorUserId: viewer.id,
      metadata: { requestId: c.get("requestId") },
      summary: "Session was revived.",
      targetId: c.req.param("id"),
      targetType: "meeting",
    });
    return c.json({ ok: true });
  });

  app.delete("/api/meetings/:id", async (c) => {
    const viewer = await requireVerifiedViewer(c);
    assertTrustedWriteOrigin(c);
    const meeting = await firstRow<{ group_id: string; owner_user_id: string }>(
      c.env.DB,
      "SELECT group_id, owner_user_id FROM meetings WHERE id = ?",
      c.req.param("id"),
    );
    assertOrThrow(meeting, 404, "Meeting not found.");
    const viewerRole = await getGroupRole(c.env.DB, meeting.group_id, viewer.id);
    const canArchive = meeting.owner_user_id === viewer.id || viewerRole === "owner" || viewerRole === "admin";
    assertOrThrow(canArchive, 403, "Only the session owner or group admins can archive this session.");
    await runStatement(
      c.env.DB,
      "UPDATE meetings SET status = 'cancelled', archived_at = ?, updated_at = ? WHERE id = ?",
      nowIso(),
      nowIso(),
      c.req.param("id"),
    );
    await writeAuditLogEvent(c.env.DB, {
      action: "meeting_archived",
      actorUserId: viewer.id,
      metadata: { requestId: c.get("requestId") },
      summary: "Session was archived.",
      targetId: c.req.param("id"),
      targetType: "meeting",
    });
    return c.json({ ok: true });
  });

  app.get("/api/meetings/:id/posts", async (c) => {
    await getMeetingDetail(c.env.DB, c.req.param("id"), c.get("viewer")?.id ?? null);
    const posts = await allRows<{ content: string; created_at: string; display_name: string; id: string }>(
      c.env.DB,
      `SELECT mp.id, mp.content, mp.created_at, u.display_name
       FROM meeting_posts mp
       JOIN users u ON u.id = mp.author_user_id
       WHERE mp.meeting_id = ?
       ORDER BY mp.created_at DESC`,
      c.req.param("id"),
    );
    return c.json({ posts });
  });

  app.post("/api/meetings/:id/posts", zValidator("json", postSchema), async (c) => {
    const viewer = await requireVerifiedViewer(c);
    assertTrustedWriteOrigin(c);
    await getMeetingDetail(c.env.DB, c.req.param("id"), viewer.id);
    const limitedResponse = await enforceWriteRateLimit(c, "write:meeting-post", viewer.id);
    if (limitedResponse) {
      return limitedResponse;
    }
    const content = c.req.valid("json").content;
    await assertPostNotSpammy(c.env.DB, {
      authorUserId: viewer.id,
      content,
      scopeColumn: "meeting_id",
      scopeId: c.req.param("id"),
      scopeLabel: "session",
      table: "meeting_posts",
    });
    await runStatement(
      c.env.DB,
      `INSERT INTO meeting_posts (id, meeting_id, author_user_id, content, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      crypto.randomUUID(),
      c.req.param("id"),
      viewer.id,
      content,
      nowIso(),
    );
    return c.json({ ok: true }, 201);
  });

  app.notFound((c) => c.json({ error: "Route not found." }, 404));

  return app;
}
