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
  postSchema,
  profileUpdateSchema,
  roleUpdateSchema,
  type MeetingSummary,
} from "../../../packages/shared/src";
import {
  clearSessionCookie,
  createSession,
  hashPassword,
  readSessionCookie,
  resolveSessionViewer,
  revokeSessionByToken,
  verifyPassword,
  writeSessionCookie,
} from "./lib/auth";
import { allRows, firstRow, runStatement } from "./lib/db";
import { assertOrThrow } from "./lib/http";
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

type ViewerRow = {
  avatar_url: string | null;
  bio: string;
  display_name: string;
  email: string;
  home_area: string;
  id: string;
  is_profile_public?: number | boolean;
  show_email_publicly?: number | boolean;
};

type HeroImageRow = {
  hero_image_url?: string | null;
};

function normalizeOptionalText(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function makeInviteCode() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

function mapViewerSummary(row: ViewerRow) {
  return {
    avatarUrl: row.avatar_url,
    bio: row.bio,
    displayName: row.display_name,
    email: row.email,
    homeArea: row.home_area,
    id: row.id,
    isProfilePublic: Boolean(row.is_profile_public),
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
    const resolved = await resolveSessionViewer(c.env.DB, readSessionCookie(c));
    c.set("sessionId", resolved?.sessionId ?? null);
    c.set("viewer", resolved?.viewer ?? null);
    await next();
  });

  app.onError((error, c) => {
    if (error instanceof HTTPException) {
      return c.json({ error: error.message }, error.status);
    }

    console.error(error);
    return c.json({ error: "Unexpected server error." }, 500);
  });

  app.get("/api/health", (c) => c.json({ ok: true }));

  app.post("/api/auth/signup", zValidator("json", authSchema), async (c) => {
    const { email, password } = c.req.valid("json");
    const existing = await firstRow<{ id: string }>(
      c.env.DB,
      "SELECT id FROM users WHERE email = ?",
      email.toLowerCase(),
    );
    assertOrThrow(!existing, 409, "An account with this email already exists.");

    const userId = crypto.randomUUID();
    const createdAt = nowIso();
    const passwordHash = await hashPassword(password);
    await runStatement(
      c.env.DB,
      `INSERT INTO users (
         id, email, password_hash, display_name, bio, home_area, avatar_url,
         is_profile_public, show_email_publicly, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, '', '', NULL, 0, 0, ?, ?)`,
      userId,
      email.toLowerCase(),
      passwordHash,
      email.split("@")[0],
      createdAt,
      createdAt,
    );

    const session = await createSession(c.env.DB, userId);
    writeSessionCookie(c, session.token, session.expiresAt);

    return c.json({
      user: {
        avatarUrl: null,
        bio: "",
        displayName: email.split("@")[0],
        email: email.toLowerCase(),
        homeArea: "",
        id: userId,
        isProfilePublic: false,
        showEmailPublicly: false,
      },
    }, 201);
  });

  app.post("/api/auth/login", zValidator("json", authSchema), async (c) => {
    const { email, password } = c.req.valid("json");
    const row = await firstRow<{
      avatar_url: string | null;
      bio: string;
      display_name: string;
      email: string;
      home_area: string;
      id: string;
      is_profile_public: number;
      password_hash: string;
      show_email_publicly: number;
    }>(
      c.env.DB,
      `SELECT id, email, password_hash, display_name, bio, home_area, avatar_url, is_profile_public, show_email_publicly
       FROM users
       WHERE email = ?`,
      email.toLowerCase(),
    );
    assertOrThrow(row, 401, "Invalid email or password.");
    const validPassword = await verifyPassword(password, row.password_hash);
    assertOrThrow(validPassword, 401, "Invalid email or password.");

    const session = await createSession(c.env.DB, row.id);
    writeSessionCookie(c, session.token, session.expiresAt);

    return c.json({
      user: mapViewerSummary(row),
    });
  });

  app.post("/api/auth/logout", async (c) => {
    await revokeSessionByToken(c.env.DB, readSessionCookie(c));
    clearSessionCookie(c);
    return c.json({ ok: true });
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
      `SELECT id, email, display_name, bio, home_area, avatar_url, is_profile_public, show_email_publicly
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
        },
      profileIsPrivate: !canViewProfile,
      attending,
      responsible,
    });
  });

  app.patch("/api/profiles/:id", zValidator("json", profileUpdateSchema), async (c) => {
    const viewer = await requireViewer(c);
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
           show_email_publicly = ?,
           updated_at = ?
       WHERE id = ?`,
      input.displayName,
      input.bio ?? "",
      input.homeArea ?? "",
      normalizeOptionalText(input.avatarUrl ?? null),
      input.isProfilePublic ? 1 : 0,
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
        showEmailPublicly: input.showEmailPublicly,
      },
    });
  });

  app.delete("/api/profiles/:id", async (c) => {
    const viewer = await requireViewer(c);
    assertOrThrow(viewer.id === c.req.param("id"), 403, "You can only delete your own profile.");
    await runStatement(c.env.DB, "DELETE FROM users WHERE id = ?", viewer.id);
    clearSessionCookie(c);
    return c.json({ ok: true });
  });

  app.post("/api/friends/requests", zValidator("json", friendRequestSchema), async (c) => {
    const viewer = await requireViewer(c);
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

    return c.json({ ok: true }, 201);
  });

  app.post("/api/friends/requests/:id/accept", async (c) => {
    const viewer = await requireViewer(c);
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
    const viewer = await requireViewer(c);
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
    const viewer = await requireViewer(c);
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
    const viewer = await requireViewer(c);
    const { group, viewerRole } = await assertCanAccessGroup(c.env.DB, c.req.param("id"), viewer.id);
    assertOrThrow(viewerRole === "owner" || viewerRole === "admin", 403, "Only group owners or admins can edit the group.");
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
    const viewer = await requireViewer(c);
    const { group, viewerRole } = await assertCanAccessGroup(c.env.DB, c.req.param("id"), viewer.id);
    assertOrThrow(viewerRole === "owner" || viewerRole === "admin", 403, "Only group owners or admins can archive the group.");
    await runStatement(
      c.env.DB,
      "UPDATE app_groups SET archived_at = ?, updated_at = ? WHERE id = ?",
      nowIso(),
      nowIso(),
      group.id,
    );
    return c.json({ ok: true });
  });

  app.post("/api/groups/:id/join", async (c) => {
    const viewer = await requireViewer(c);
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

  app.post(
    "/api/groups/:id/membership-requests",
    zValidator("json", z.object({ note: z.string().trim().max(300).optional().nullable() })),
    async (c) => {
      const viewer = await requireViewer(c);
      const group = await getGroupRecord(c.env.DB, c.req.param("id"));
      const existingRole = await getGroupRole(c.env.DB, group.id, viewer.id);
      assertOrThrow(!existingRole, 400, "You are already a member of this group.");
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
    const viewer = await requireViewer(c);
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
    const viewer = await requireViewer(c);
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
    const viewer = await requireViewer(c);
    const { group, viewerRole } = await assertCanAccessGroup(c.env.DB, c.req.param("id"), viewer.id);
    assertOrThrow(group.visibility === "private", 400, "Invite links are only needed for private groups.");
    assertOrThrow(viewerRole === "owner", 403, "Only the group owner can create invite links.");

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
    return c.json({ code }, 201);
  });

  app.post("/api/groups/invite-links/:code/accept", async (c) => {
    const viewer = await requireViewer(c);
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
    const viewer = await requireViewer(c);
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
    const viewer = await requireViewer(c);
    await assertCanAccessGroup(c.env.DB, c.req.param("id"), viewer.id);
    await runStatement(
      c.env.DB,
      `INSERT INTO group_posts (id, group_id, author_user_id, content, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      crypto.randomUUID(),
      c.req.param("id"),
      viewer.id,
      c.req.valid("json").content,
      nowIso(),
    );
    return c.json({ ok: true }, 201);
  });

  app.get("/api/venues", async (c) => {
    const venues = await allRows<{
      address: string;
      booking_url: string | null;
      description: string;
      hero_image_url: string | null;
      id: string;
      latitude: number;
      longitude: number;
      name: string;
      opening_hours_text: string | null;
      pricing: "free" | "paid";
      source_url: string | null;
    }>(
      c.env.DB,
      `SELECT id, name, address, description, pricing, latitude, longitude, source_url, booking_url, opening_hours_text, hero_image_url
       FROM venues
       ORDER BY name ASC`,
    );
    return c.json({
      venues: venues.map((venue) => ({
        address: venue.address,
        description: venue.description,
        heroImageUrl: venue.hero_image_url,
        id: venue.id,
        latitude: Number(venue.latitude),
        longitude: Number(venue.longitude),
        name: venue.name,
        bookingUrl: venue.booking_url,
        openingHoursText: venue.opening_hours_text,
        pricing: venue.pricing,
        sourceUrl: venue.source_url,
      })),
    });
  });

  app.get("/api/venues/:id", async (c) => {
    await ensureSeriesCoverage(c.env.DB);
    const viewerId = c.get("viewer")?.id ?? null;

    const venue = await firstRow<{
      address: string;
      booking_url: string | null;
      description: string;
      hero_image_url: string | null;
      id: string;
      latitude: number;
      longitude: number;
      name: string;
      opening_hours_text: string | null;
      pricing: "free" | "paid";
      source_url: string | null;
    }>(
      c.env.DB,
      `SELECT id, name, address, description, pricing, latitude, longitude, source_url, booking_url, opening_hours_text, hero_image_url
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
      venue: {
        address: venue.address,
        description: venue.description,
        heroImageUrl: venue.hero_image_url,
        id: venue.id,
        latitude: Number(venue.latitude),
        longitude: Number(venue.longitude),
        name: venue.name,
        bookingUrl: venue.booking_url,
        openingHoursText: venue.opening_hours_text,
        pricing: venue.pricing,
        sourceUrl: venue.source_url,
      },
    });
  });

  app.get("/api/map", zValidator("query", mapQuerySchema), async (c) => {
    await ensureSeriesCoverage(c.env.DB);
    const query = c.req.valid("query");
    const viewerId = c.get("viewer")?.id ?? null;

    const venues = await allRows<{
      address: string;
      booking_url: string | null;
      description: string;
      hero_image_url: string | null;
      id: string;
      latitude: number;
      longitude: number;
      name: string;
      opening_hours_text: string | null;
      pricing: "free" | "paid";
      source_url: string | null;
    }>(
      c.env.DB,
      `SELECT id, name, address, description, pricing, latitude, longitude, source_url, booking_url, opening_hours_text, hero_image_url
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
      venues: venues.map((venue) => ({
        address: venue.address,
        description: venue.description,
        heroImageUrl: venue.hero_image_url,
        id: venue.id,
        latitude: Number(venue.latitude),
        longitude: Number(venue.longitude),
        name: venue.name,
        bookingUrl: venue.booking_url,
        openingHoursText: venue.opening_hours_text,
        pricing: venue.pricing,
        sourceUrl: venue.source_url,
      })),
    });
  });

  app.get("/api/meetings", async (c) => {
    await ensureSeriesCoverage(c.env.DB);
    const groupId = c.req.query("groupId") ?? undefined;
    const meetings = await listAccessibleMeetings(c.env.DB, c.get("viewer")?.id ?? null, { groupId });
    return c.json({ meetings });
  });

  app.post("/api/meetings", zValidator("json", meetingCreateSchema), async (c) => {
    const viewer = await requireViewer(c);
    const input = c.req.valid("json");
    const { group, viewerRole } = await assertCanAccessGroup(c.env.DB, input.groupId, viewer.id);

    const canCreate =
      group.visibility === "private"
        ? Boolean(viewerRole)
        : viewerRole === "owner" || viewerRole === "admin";
    assertOrThrow(canCreate, 403, "You do not have permission to create meetings in this group.");

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
      user_id: string;
    }>(
      c.env.DB,
      `SELECT u.id AS user_id, u.email, u.display_name, u.bio, u.home_area, u.avatar_url
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
    const viewer = await requireViewer(c);
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
    const viewer = await requireViewer(c);
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
    const viewer = await requireViewer(c);
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
    const viewer = await requireViewer(c);
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
    return c.json({ ok: true });
  });

  app.post("/api/meetings/:id/revive", async (c) => {
    const viewer = await requireViewer(c);
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
    return c.json({ ok: true });
  });

  app.delete("/api/meetings/:id", async (c) => {
    const viewer = await requireViewer(c);
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
    const viewer = await requireViewer(c);
    await getMeetingDetail(c.env.DB, c.req.param("id"), viewer.id);
    await runStatement(
      c.env.DB,
      `INSERT INTO meeting_posts (id, meeting_id, author_user_id, content, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      crypto.randomUUID(),
      c.req.param("id"),
      viewer.id,
      c.req.valid("json").content,
      nowIso(),
    );
    return c.json({ ok: true }, 201);
  });

  app.notFound((c) => c.json({ error: "Route not found." }, 404));

  return app;
}
