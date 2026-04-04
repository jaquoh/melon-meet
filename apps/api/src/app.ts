import { zValidator } from "@hono/zod-validator";
import { format, getDay } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import type { Context } from "hono";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
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
    created_at: string;
    description: string;
    id: string;
    name: string;
    owner_user_id: string;
    slug: string;
    updated_at: string;
    visibility: GroupVisibility;
  }>(
    db,
    `SELECT id, owner_user_id, name, slug, description, visibility, activity_label, created_at, updated_at
     FROM app_groups
     WHERE id = ?`,
    groupId,
  );
  assertOrThrow(row, 404, "Group not found.");
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
    id: string;
    member_count: number;
    name: string;
    owner_user_id: string;
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
       g.owner_user_id,
       COALESCE((SELECT COUNT(*) FROM app_group_members gm WHERE gm.group_id = g.id), 0) AS member_count,
       (
         SELECT gm.role
         FROM app_group_members gm
         WHERE gm.group_id = g.id
           AND gm.user_id = ?
         LIMIT 1
       ) AS viewer_role
     FROM app_groups g
     WHERE g.visibility = 'public'
        OR (? IS NOT NULL AND EXISTS (
          SELECT 1
          FROM app_group_members gm
          WHERE gm.group_id = g.id
            AND gm.user_id = ?
        ))
     ORDER BY g.created_at DESC`,
    viewerId,
    viewerId,
    viewerId,
  );

  return rows.map((row) => ({
    activityLabel: row.activity_label,
    description: row.description,
    id: row.id,
    memberCount: Number(row.member_count),
    name: row.name,
    ownerUserId: row.owner_user_id,
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
    description: (row.description as string | null) ?? null,
    endsAt: String(row.ends_at),
    groupId: String(row.group_id),
    groupName: String(row.group_name),
    groupVisibility: row.group_visibility as "public" | "private",
    id: String(row.id),
    latitude: Number(row.latitude),
    locationAddress: String(row.location_address),
    locationName: String(row.location_name),
    longitude: Number(row.longitude),
    openSpots: Math.max(0, capacity - claimedSpots),
    ownerUserId: String(row.owner_user_id),
    pricing: row.pricing as "free" | "paid",
    seriesId: (row.series_id as string | null) ?? null,
    startsAt: String(row.starts_at),
    status: row.status as "active" | "cancelled",
    title: String(row.title),
    venueId: (row.venue_id as string | null) ?? null,
    viewerCanEdit: Boolean(row.viewer_can_edit),
    viewerHasClaimed: Boolean(row.viewer_has_claimed),
  };
}

async function listAccessibleMeetings(
  db: D1Database,
  viewerId: string | null,
  options?: {
    endAt?: string;
    groupId?: string;
    meetingId?: string;
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
       m.title,
       m.description,
       m.activity_label,
       m.location_name,
       m.location_address,
       m.latitude,
       m.longitude,
       m.pricing,
       m.capacity,
       m.starts_at,
       m.ends_at,
       m.status,
       m.venue_id,
       m.series_id,
       COALESCE((SELECT COUNT(*) FROM meeting_claims mc WHERE mc.meeting_id = m.id), 0) AS claimed_spots,
       CASE WHEN ? IS NOT NULL AND EXISTS (
         SELECT 1
         FROM meeting_claims mc
         WHERE mc.meeting_id = m.id
           AND mc.user_id = ?
       ) THEN 1 ELSE 0 END AS viewer_has_claimed,
       CASE WHEN ? IS NOT NULL AND m.owner_user_id = ? THEN 1 ELSE 0 END AS viewer_can_edit
     FROM meetings m
     JOIN app_groups g ON g.id = m.group_id
     WHERE m.status = 'active'
       AND (? IS NULL OR m.id = ?)
       AND (? IS NULL OR m.group_id = ?)
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
    options?.meetingId ?? null,
    options?.meetingId ?? null,
    options?.groupId ?? null,
    options?.groupId ?? null,
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
  return meetings.filter((meeting) => meeting.openSpots > 0);
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
      `INSERT INTO users (id, email, password_hash, display_name, bio, home_area, avatar_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, '', '', NULL, ?, ?)`,
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
      password_hash: string;
    }>(
      c.env.DB,
      `SELECT id, email, password_hash, display_name, bio, home_area, avatar_url
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
      user: {
        avatarUrl: row.avatar_url,
        bio: row.bio,
        displayName: row.display_name,
        email: row.email,
        homeArea: row.home_area,
        id: row.id,
      },
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
      avatar_url: string | null;
      bio: string;
      connection_id: string;
      direction: "incoming" | "outgoing";
      display_name: string;
      email: string;
      home_area: string;
      status: "pending" | "accepted";
      user_id: string;
    }>(
      c.env.DB,
      `SELECT
         fc.id AS connection_id,
         fc.status,
         CASE WHEN fc.requester_user_id = ? THEN 'outgoing' ELSE 'incoming' END AS direction,
         u.id AS user_id,
         u.email,
         u.display_name,
         u.bio,
         u.home_area,
         u.avatar_url
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
        user: {
          avatarUrl: friend.avatar_url,
          bio: friend.bio,
          displayName: friend.display_name,
          email: friend.email,
          homeArea: friend.home_area,
          id: friend.user_id,
        },
      })),
      groups,
      viewer,
    });
  });

  app.get("/api/profiles/:id", async (c) => {
    const row = await firstRow<{
      avatar_url: string | null;
      bio: string;
      display_name: string;
      email: string;
      home_area: string;
      id: string;
    }>(
      c.env.DB,
      `SELECT id, email, display_name, bio, home_area, avatar_url
       FROM users
       WHERE id = ?`,
      c.req.param("id"),
    );
    assertOrThrow(row, 404, "Profile not found.");

    const viewer = c.get("viewer");
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

    return c.json({
      friendship,
      profile: {
        avatarUrl: row.avatar_url,
        bio: row.bio,
        displayName: row.display_name,
        email: viewer?.id === row.id ? row.email : "",
        homeArea: row.home_area,
        id: row.id,
      },
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
       SET display_name = ?, bio = ?, home_area = ?, avatar_url = ?, updated_at = ?
       WHERE id = ?`,
      input.displayName,
      input.bio ?? "",
      input.homeArea ?? "",
      normalizeOptionalText(input.avatarUrl ?? null),
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
      },
    });
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
         id, owner_user_id, name, slug, description, visibility, activity_label, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      groupId,
      viewer.id,
      input.name,
      input.slug,
      input.description,
      input.visibility,
      normalizeOptionalText(input.activityLabel ?? null),
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
        id: group.id,
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
        user: {
          avatarUrl: member.avatar_url,
          bio: member.bio,
          displayName: member.display_name,
          email: member.email,
          homeArea: member.home_area,
          id: member.user_id,
        },
      })),
      posts: posts.map((post) => ({
        author: {
          avatarUrl: post.author_avatar_url,
          bio: post.author_bio,
          displayName: post.author_display_name,
          email: post.author_email,
          homeArea: post.author_home_area,
          id: post.author_id,
        },
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
           updated_at = ?
       WHERE id = ?`,
      input.name ?? null,
      input.slug ?? null,
      input.description ?? null,
      input.visibility ?? null,
      input.activityLabel === undefined ? null : normalizeOptionalText(input.activityLabel ?? null),
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
      description: string;
      id: string;
      latitude: number;
      longitude: number;
      name: string;
      pricing: "free" | "paid";
      source_url: string | null;
    }>(
      c.env.DB,
      `SELECT id, name, address, description, pricing, latitude, longitude, source_url
       FROM venues
       ORDER BY name ASC`,
    );
    return c.json({
      venues: venues.map((venue) => ({
        address: venue.address,
        description: venue.description,
        id: venue.id,
        latitude: Number(venue.latitude),
        longitude: Number(venue.longitude),
        name: venue.name,
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
      description: string;
      id: string;
      latitude: number;
      longitude: number;
      name: string;
      pricing: "free" | "paid";
      source_url: string | null;
    }>(
      c.env.DB,
      `SELECT id, name, address, description, pricing, latitude, longitude, source_url
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
        id: venue.id,
        latitude: Number(venue.latitude),
        longitude: Number(venue.longitude),
        name: venue.name,
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
      description: string;
      id: string;
      latitude: number;
      longitude: number;
      name: string;
      pricing: "free" | "paid";
      source_url: string | null;
    }>(
      c.env.DB,
      `SELECT id, name, address, description, pricing, latitude, longitude, source_url
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
        id: venue.id,
        latitude: Number(venue.latitude),
        longitude: Number(venue.longitude),
        name: venue.name,
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
           id, group_id, owner_user_id, title, description, activity_label, venue_id, location_name,
           location_address, latitude, longitude, pricing, capacity, timezone, weekday, start_time_local,
           duration_minutes, start_date, until_date, status, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
        seriesId,
        group.id,
        viewer.id,
        input.title,
        normalizeOptionalText(input.description ?? null),
        groupActivity,
        normalizeOptionalText(input.venueId ?? null),
        input.locationName,
        input.locationAddress,
        input.latitude,
        input.longitude,
        input.pricing,
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
         id, group_id, owner_user_id, series_id, title, description, activity_label, venue_id,
         location_name, location_address, latitude, longitude, pricing, capacity, starts_at, ends_at,
         occurrence_date, status, created_at, updated_at
       ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      meetingId,
      group.id,
      viewer.id,
      input.title,
      normalizeOptionalText(input.description ?? null),
      groupActivity,
      normalizeOptionalText(input.venueId ?? null),
      input.locationName,
      input.locationAddress,
      input.latitude,
      input.longitude,
      input.pricing,
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
        avatarUrl: claim.avatar_url,
        bio: claim.bio,
        displayName: claim.display_name,
        email: claim.email,
        homeArea: claim.home_area,
        id: claim.user_id,
      })),
      meeting,
      posts: posts.map((post) => ({
        author: {
          avatarUrl: post.author_avatar_url,
          bio: post.author_bio,
          displayName: post.author_display_name,
          email: post.author_email,
          homeArea: post.author_home_area,
          id: post.author_id,
        },
        content: post.content,
        createdAt: post.created_at,
        id: post.id,
      })),
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
      id: string;
      latitude: number;
      location_address: string;
      location_name: string;
      longitude: number;
      owner_user_id: string;
      pricing: "free" | "paid";
      series_id: string | null;
      starts_at: string;
      title: string;
      venue_id: string | null;
    }>(
      c.env.DB,
      `SELECT id, group_id, owner_user_id, series_id, title, description, activity_label, venue_id,
              location_name, location_address, latitude, longitude, pricing, capacity, starts_at, ends_at
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
      const localStartDate = isoToLocalDate(nextStartsAt, timezone);
      const localStartTime = isoToLocalTime(nextStartsAt, timezone);
      const weekday = getDay(fromZonedTime(`${localStartDate}T${localStartTime}:00`, timezone));

      await runStatement(
        c.env.DB,
        `UPDATE meeting_series
         SET title = ?,
             description = ?,
             activity_label = ?,
             venue_id = ?,
             location_name = ?,
             location_address = ?,
             latitude = ?,
             longitude = ?,
             pricing = ?,
             capacity = ?,
             weekday = ?,
             start_time_local = ?,
             duration_minutes = ?,
             updated_at = ?
         WHERE id = ?`,
        input.title ?? meetingRow.title,
        input.description === undefined ? meetingRow.description : normalizeOptionalText(input.description),
        input.activityLabel === undefined ? meetingRow.activity_label : normalizeOptionalText(input.activityLabel),
        input.venueId === undefined ? meetingRow.venue_id : normalizeOptionalText(input.venueId),
        input.locationName ?? meetingRow.location_name,
        input.locationAddress ?? meetingRow.location_address,
        input.latitude ?? meetingRow.latitude,
        input.longitude ?? meetingRow.longitude,
        input.pricing ?? meetingRow.pricing,
        input.capacity ?? meetingRow.capacity,
        weekday,
        localStartTime,
        durationMinutes(nextStartsAt, nextEndsAt),
        nowIso(),
        meetingRow.series_id,
      );

      await ensureSeriesCoverage(c.env.DB, {
        fromDate: localStartDate,
        horizon: series.until_date ?? horizonDate(),
        seriesId: meetingRow.series_id,
      });

      return c.json({ ok: true });
    }

    await runStatement(
      c.env.DB,
      `UPDATE meetings
       SET title = ?,
           description = ?,
           activity_label = ?,
           venue_id = ?,
           location_name = ?,
           location_address = ?,
           latitude = ?,
           longitude = ?,
           pricing = ?,
           capacity = ?,
           starts_at = ?,
           ends_at = ?,
           occurrence_date = ?,
           updated_at = ?
       WHERE id = ?`,
      input.title ?? meetingRow.title,
      input.description === undefined ? meetingRow.description : normalizeOptionalText(input.description),
      input.activityLabel === undefined ? meetingRow.activity_label : normalizeOptionalText(input.activityLabel),
      input.venueId === undefined ? meetingRow.venue_id : normalizeOptionalText(input.venueId),
      input.locationName ?? meetingRow.location_name,
      input.locationAddress ?? meetingRow.location_address,
      input.latitude ?? meetingRow.latitude,
      input.longitude ?? meetingRow.longitude,
      input.pricing ?? meetingRow.pricing,
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
    const meeting = await firstRow<{ owner_user_id: string }>(
      c.env.DB,
      "SELECT owner_user_id FROM meetings WHERE id = ?",
      c.req.param("id"),
    );
    assertOrThrow(meeting, 404, "Meeting not found.");
    assertOrThrow(meeting.owner_user_id === viewer.id, 403, "Only the meeting owner can cancel this meeting.");
    await runStatement(
      c.env.DB,
      "UPDATE meetings SET status = 'cancelled', updated_at = ? WHERE id = ?",
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
