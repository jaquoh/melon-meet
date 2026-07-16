import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "./app";
import { createSession, hashOpaqueToken, verifyPassword } from "./lib/auth";
import { writeAuditLogEvent } from "./lib/audit-log";
import { firstRow } from "./lib/db";
import type { AppBindings } from "./types/env";
import { CURRENT_POLICY_VERSIONS } from "../../../packages/shared/src";

const FIXED_NOW = "2026-05-11T10:00:00.000Z";
const APP_BASE_URL = "https://www.melonmeet.com";
const LOCAL_BASE_URL = "http://localhost:8787";
const SESSION_COOKIE_NAME = "melon_meet_session";

const migrationsDir = fileURLToPath(new URL("../migrations", import.meta.url));

type SqliteValue = string | number | bigint | Uint8Array | null;

class SqliteD1Statement {
  constructor(
    private readonly db: DatabaseSync,
    private readonly sql: string,
    private readonly params: SqliteValue[] = [],
  ) {}

  bind(...params: SqliteValue[]) {
    return new SqliteD1Statement(this.db, this.sql, params);
  }

  async all<T>() {
    const statement = this.db.prepare(this.sql);
    const results = statement.all(...this.params) as T[];
    return { results };
  }

  async first<T>() {
    const statement = this.db.prepare(this.sql);
    const row = statement.get(...this.params) as T | undefined;
    return row ?? null;
  }

  async run() {
    const statement = this.db.prepare(this.sql);
    const result = statement.run(...this.params);
    return {
      meta: {
        changes: Number(result.changes),
        last_row_id: Number(result.lastInsertRowid ?? 0),
      },
      success: true,
    } as D1Result;
  }
}

class SqliteD1Database {
  readonly sqlite = new DatabaseSync(":memory:");

  constructor() {
    this.sqlite.exec("PRAGMA foreign_keys = ON;");
  }

  applyMigrations() {
    const migrationFiles = readdirSync(migrationsDir)
      .filter((entry) => entry.endsWith(".sql"))
      .sort();

    for (const migrationFile of migrationFiles) {
      this.sqlite.exec(readFileSync(join(migrationsDir, migrationFile), "utf8"));
    }
  }

  prepare(sql: string) {
    return new SqliteD1Statement(this.sqlite, sql);
  }
}

function createTestEnv(db: D1Database): AppBindings {
  return {
    ALERT_WEBHOOK_URL: undefined,
    APP_NAME: "Melon Meet",
    ASSETS: {} as Fetcher,
    DB: db,
    DEFAULT_TIMEZONE: "Europe/Berlin",
    EMAIL_FROM_ADDRESS: "Melon Meet <noreply@mail.melonmeet.com>",
    EMAIL_REPLY_TO_ADDRESS: "hello@melonmeet.com",
    ENVIRONMENT_NAME: "test",
    MODERATION_ADMIN_EMAILS: "admin@example.com",
    MODERATION_REVIEWER_EMAILS: "reviewer@example.com",
    RESEND_API_KEY: undefined,
    TURNSTILE_SECRET_KEY: undefined,
    TURNSTILE_SITE_KEY: undefined,
  };
}

function mockEmailDelivery() {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({
    json: async () => ({ id: "email-test-id" }),
    ok: true,
  } as Response);
}

async function insertUser(
  db: D1Database,
  {
    displayName,
    email,
    id,
    notificationPreferences,
    status = "active",
  }: {
    displayName: string;
    email: string;
    id: string;
    notificationPreferences?: Partial<{
      groupMemberLeaveEmails: boolean;
      groupMembershipRequestEmails: boolean;
      groupNewSessionEmails: boolean;
      groupArchivedEmails: boolean;
      moderationAndAccountEmails: boolean;
      sessionCancellationEmails: boolean;
      sessionChangeEmails: boolean;
      sessionPinboardEmails: boolean;
      sessionSpotClaimEmails: boolean;
      sessionSpotFilledEmails: boolean;
      sessionSpotReleaseEmails: boolean;
    }>;
    status?: "active" | "deletion-pending" | "suspended";
  },
) {
  await db.prepare(
    `INSERT INTO users (
       id, email, password_hash, display_name, bio, home_area, avatar_url,
       created_at, updated_at, is_profile_public, show_email_publicly,
       playing_level, email_verified_at, account_status,
       notification_moderation_and_account_emails,
       notification_group_membership_request_emails,
       notification_group_member_leave_emails,
       notification_group_new_session_emails,
       notification_group_archived_emails,
       notification_session_cancellation_emails,
       notification_session_change_emails,
       notification_session_pinboard_emails,
       notification_session_spot_claim_emails,
       notification_session_spot_release_emails,
       notification_session_spot_filled_emails,
       deletion_requested_at, deleted_at
     ) VALUES (?, ?, ?, ?, '', '', NULL, ?, ?, 0, 0, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
  )
    .bind(
      id,
      email,
      "test-password-hash",
      displayName,
      FIXED_NOW,
      FIXED_NOW,
      FIXED_NOW,
      status,
      notificationPreferences?.moderationAndAccountEmails === false ? 0 : 1,
      notificationPreferences?.groupMembershipRequestEmails === false ? 0 : 1,
      notificationPreferences?.groupMemberLeaveEmails === false ? 0 : 1,
      notificationPreferences?.groupNewSessionEmails === false ? 0 : 1,
      notificationPreferences?.groupArchivedEmails === false ? 0 : 1,
      notificationPreferences?.sessionCancellationEmails === false ? 0 : 1,
      notificationPreferences?.sessionChangeEmails === false ? 0 : 1,
      notificationPreferences?.sessionPinboardEmails === false ? 0 : 1,
      notificationPreferences?.sessionSpotClaimEmails === false ? 0 : 1,
      notificationPreferences?.sessionSpotReleaseEmails === false ? 0 : 1,
      notificationPreferences?.sessionSpotFilledEmails === false ? 0 : 1,
    )
    .run();
}

async function insertProfileReport(
  db: D1Database,
  {
    id,
    reporterUserId,
    targetUserId,
  }: {
    id: string;
    reporterUserId: string;
    targetUserId: string;
  },
) {
  await db.prepare(
    `INSERT INTO content_reports (
       id, reporter_user_id, target_type, target_id, reason, note, status,
       internal_notes, resolution, assignee_user_id, created_at, updated_at
     ) VALUES (?, ?, 'profile', ?, 'harassment', 'Needs review', 'open', NULL, NULL, NULL, ?, ?)`,
  )
    .bind(id, reporterUserId, targetUserId, FIXED_NOW, FIXED_NOW)
    .run();
}

async function insertGroup(
  db: D1Database,
  {
    id,
    name,
    ownerUserId,
    slug,
    visibility = "public",
  }: {
    id: string;
    name: string;
    ownerUserId: string;
    slug: string;
    visibility?: "public" | "private";
  },
) {
  await db.prepare(
    `INSERT INTO app_groups (
       id, owner_user_id, name, slug, description, visibility, activity_label, messenger_url, hero_image_url, created_at, updated_at
     ) VALUES (?, ?, ?, ?, 'Test group description', ?, 'Beach volleyball', NULL, NULL, ?, ?)`,
  )
    .bind(id, ownerUserId, name, slug, visibility, FIXED_NOW, FIXED_NOW)
    .run();
}

async function insertGroupMember(
  db: D1Database,
  {
    groupId,
    role,
    userId,
  }: {
    groupId: string;
    role: "owner" | "admin" | "member";
    userId: string;
  },
) {
  await db.prepare(
    `INSERT INTO app_group_members (id, group_id, user_id, role, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(crypto.randomUUID(), groupId, userId, role, FIXED_NOW)
    .run();
}

async function insertMeeting(
  db: D1Database,
  {
    groupId,
    id,
    ownerUserId,
    title,
  }: {
    groupId: string;
    id: string;
    ownerUserId: string;
    title: string;
  },
) {
  await db.prepare(
    `INSERT INTO meetings (
       id, group_id, owner_user_id, series_id, short_name, title, description, activity_label, hero_image_url, venue_id,
       location_name, location_address, latitude, longitude, pricing, cost_per_person, capacity, starts_at, ends_at,
       occurrence_date, status, created_at, updated_at, archived_at
     ) VALUES (?, ?, ?, NULL, 'sunset', ?, 'Bring a ball', 'Beach volleyball', NULL, NULL, 'Beach Court', 'Sand Street 1', 52.52, 13.405, 'free', NULL, 12, '2026-08-01T18:00:00.000Z', '2026-08-01T20:00:00.000Z', '2026-08-01', 'active', ?, ?, NULL)`,
  )
    .bind(id, groupId, ownerUserId, title, FIXED_NOW, FIXED_NOW)
    .run();
}

async function insertMeetingClaim(
  db: D1Database,
  {
    meetingId,
    userId,
  }: {
    meetingId: string;
    userId: string;
  },
) {
  await db.prepare(
    `INSERT INTO meeting_claims (id, meeting_id, user_id, created_at)
     VALUES (?, ?, ?, ?)`,
  )
    .bind(crypto.randomUUID(), meetingId, userId, FIXED_NOW)
    .run();
}

async function makeSessionCookie(db: D1Database, userId: string) {
  const session = await createSession(db, userId);
  return `${SESSION_COOKIE_NAME}=${session.token}`;
}

async function requestJson(
  path: string,
  {
    baseUrl = APP_BASE_URL,
    body,
    cookie,
    env,
    method = "GET",
    origin,
  }: {
    baseUrl?: string;
    body?: Record<string, unknown>;
    cookie?: string;
    env: AppBindings;
    method?: "DELETE" | "GET" | "PATCH" | "POST";
    origin?: string;
  },
) {
  const app = createApp();
  const headers = new Headers();
  if (cookie) {
    headers.set("Cookie", cookie);
  }
  if (body) {
    headers.set("Content-Type", "application/json");
    headers.set("Origin", origin ?? baseUrl);
  } else if (origin) {
    headers.set("Origin", origin);
  }

  const response = await app.fetch(
    new Request(`${baseUrl}${path}`, {
      body: body ? JSON.stringify(body) : undefined,
      headers,
      method,
    }),
    env as never,
    {} as never,
  );

  return response;
}

describe("moderation authorization", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("rejects unauthenticated moderation queue access", async () => {
    const db = new SqliteD1Database();
    db.applyMigrations();
    const env = createTestEnv(db as unknown as D1Database);

    const response = await requestJson("/api/moderation/reports", {
      env,
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: "Sign in required.",
    });
  });

  it("rejects regular signed-in users from moderation queue access", async () => {
    const db = new SqliteD1Database();
    db.applyMigrations();
    const env = createTestEnv(db as unknown as D1Database);

    await insertUser(env.DB, {
      displayName: "Regular User",
      email: "member@example.com",
      id: "user-regular",
    });
    const cookie = await makeSessionCookie(env.DB, "user-regular");

    const response = await requestJson("/api/moderation/reports", {
      cookie,
      env,
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "You do not have moderation access.",
    });
  });

  it("allows support reviewers to list and triage reports but blocks admin actions", async () => {
    const db = new SqliteD1Database();
    db.applyMigrations();
    const env = createTestEnv(db as unknown as D1Database);

    await insertUser(env.DB, {
      displayName: "Reporter",
      email: "reporter@example.com",
      id: "user-reporter",
    });
    await insertUser(env.DB, {
      displayName: "Reported User",
      email: "target@example.com",
      id: "user-target",
    });
    await insertUser(env.DB, {
      displayName: "Support Reviewer",
      email: "reviewer@example.com",
      id: "user-reviewer",
    });
    await insertProfileReport(env.DB, {
      id: "report-1",
      reporterUserId: "user-reporter",
      targetUserId: "user-target",
    });
    const cookie = await makeSessionCookie(env.DB, "user-reviewer");

    const listResponse = await requestJson("/api/moderation/reports", {
      cookie,
      env,
    });

    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toMatchObject({
      reports: [
        {
          id: "report-1",
          reason: "harassment",
          status: "open",
          targetLabel: "Profile: Reported User",
        },
      ],
      viewerModerationRole: "support_reviewer",
    });

    const patchResponse = await requestJson("/api/moderation/reports/report-1", {
      body: {
        internalNotes: "Triaged by support.",
        status: "triaged",
      },
      cookie,
      env,
      method: "PATCH",
    });

    expect(patchResponse.status).toBe(200);
    await expect(patchResponse.json()).resolves.toMatchObject({
      report: {
        id: "report-1",
        internalNotes: "Triaged by support.",
        status: "triaged",
      },
    });

    const actionResponse = await requestJson("/api/moderation/reports/report-1/actions", {
      body: {
        action: "suspend_user",
      },
      cookie,
      env,
      method: "POST",
    });

    expect(actionResponse.status).toBe(403);
    await expect(actionResponse.json()).resolves.toMatchObject({
      error: "You do not have moderation access.",
    });
  });

  it("allows admins to take enforcement actions and records the result", async () => {
    const db = new SqliteD1Database();
    db.applyMigrations();
    const env = {
      ...createTestEnv(db as unknown as D1Database),
      RESEND_API_KEY: "test-resend-key",
    };
    mockEmailDelivery();

    await insertUser(env.DB, {
      displayName: "Reporter",
      email: "reporter@example.com",
      id: "user-reporter",
    });
    await insertUser(env.DB, {
      displayName: "Reported User",
      email: "target@example.com",
      id: "user-target",
    });
    await insertUser(env.DB, {
      displayName: "Admin",
      email: "admin@example.com",
      id: "user-admin",
    });
    await insertProfileReport(env.DB, {
      id: "report-2",
      reporterUserId: "user-reporter",
      targetUserId: "user-target",
    });

    const targetSession = await createSession(env.DB, "user-target");
    const adminCookie = await makeSessionCookie(env.DB, "user-admin");

    const response = await requestJson("/api/moderation/reports/report-2/actions", {
      body: {
        action: "suspend_user",
      },
      cookie: adminCookie,
      env,
      method: "POST",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      report: {
        assignee: {
          id: "user-admin",
        },
        id: "report-2",
        resolution: "Admin suspended the reported user account.",
        status: "action_taken",
      },
    });

    const suspendedUser = await firstRow<{ account_status: string }>(
      env.DB,
      "SELECT account_status FROM users WHERE id = ?",
      "user-target",
    );
    expect(suspendedUser?.account_status).toBe("suspended");

    const revokedSession = await firstRow<{ id: string }>(
      env.DB,
      "SELECT id FROM sessions WHERE token_hash = ?",
      await hashOpaqueToken(targetSession.token),
    );
    expect(revokedSession).toBeNull();

    const auditRow = await firstRow<{ action: string; target_id: string }>(
      env.DB,
      "SELECT action, target_id FROM audit_log_events WHERE action = ? LIMIT 1",
      "moderation_admin_action_taken",
    );
    expect(auditRow).toMatchObject({
      action: "moderation_admin_action_taken",
      target_id: "user-target",
    });
  });

  it("allows admins to bootstrap a local-only smoke account and returns a generated password", async () => {
    const db = new SqliteD1Database();
    db.applyMigrations();
    const env = createTestEnv(db as unknown as D1Database);

    await insertUser(env.DB, {
      displayName: "Admin",
      email: "admin@example.com",
      id: "user-admin",
    });
    const adminCookie = await makeSessionCookie(env.DB, "user-admin");

    const response = await requestJson("/api/admin/smoke-account", {
      body: {
        displayName: "Smoke Tester",
        email: "smoke-prod@melonmeet.local",
      },
      cookie: adminCookie,
      env,
      method: "POST",
      origin: APP_BASE_URL,
    });

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      account: { created: boolean; displayName: string; email: string };
      generatedPassword: string;
      ok: true;
    };

    expect(payload.ok).toBe(true);
    expect(payload.account.email).toBe("smoke-prod@melonmeet.local");
    expect(payload.account.displayName).toBe("Smoke Tester");
    expect(payload.generatedPassword.length).toBeGreaterThanOrEqual(20);

    const user = await firstRow<{
      account_status: string;
      display_name: string;
      email_verified_at: string | null;
      password_hash: string;
    }>(
      env.DB,
      `SELECT password_hash, display_name, email_verified_at, account_status
       FROM users
       WHERE email = ?`,
      "smoke-prod@melonmeet.local",
    );
    expect(user?.display_name).toBe("Smoke Tester");
    expect(user?.account_status).toBe("active");
    expect(user?.email_verified_at).toBeTruthy();
    await expect(verifyPassword(payload.generatedPassword, user?.password_hash ?? "")).resolves.toBe(true);
  });

  it("blocks support reviewers from bootstrapping smoke accounts", async () => {
    const db = new SqliteD1Database();
    db.applyMigrations();
    const env = createTestEnv(db as unknown as D1Database);

    await insertUser(env.DB, {
      displayName: "Reviewer",
      email: "reviewer@example.com",
      id: "user-reviewer",
    });
    const reviewerCookie = await makeSessionCookie(env.DB, "user-reviewer");

    const response = await requestJson("/api/admin/smoke-account", {
      body: {
        email: "smoke-review@melonmeet.local",
      },
      cookie: reviewerCookie,
      env,
      method: "POST",
      origin: APP_BASE_URL,
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "You do not have moderation access.",
    });
  });

  it("returns launch dashboard metrics for moderation viewers", async () => {
    const db = new SqliteD1Database();
    db.applyMigrations();
    const env = createTestEnv(db as unknown as D1Database);

    await insertUser(env.DB, { displayName: "Admin", email: "admin@example.com", id: "user-admin" });
    await insertUser(env.DB, { displayName: "Member", email: "member@example.com", id: "user-member" });
    await insertUser(env.DB, {
      displayName: "Suspended",
      email: "suspended@example.com",
      id: "user-suspended",
      status: "suspended",
    });
    await insertGroup(env.DB, { id: "group-dashboard", name: "Dashboard Crew", ownerUserId: "user-admin", slug: "dashboard-crew", visibility: "private" });
    await insertGroupMember(env.DB, { groupId: "group-dashboard", role: "owner", userId: "user-admin" });
    await insertMeeting(env.DB, { groupId: "group-dashboard", id: "meeting-dashboard", ownerUserId: "user-admin", title: "Dashboard Session" });
    await insertProfileReport(env.DB, {
      id: "report-dashboard",
      reporterUserId: "user-member",
      targetUserId: "user-suspended",
    });
    await writeAuditLogEvent(env.DB, {
      action: "group_created",
      actorUserId: "user-admin",
      summary: "Created dashboard crew",
      targetId: "group-dashboard",
      targetType: "group",
    });
    const adminCookie = await makeSessionCookie(env.DB, "user-admin");

    const response = await requestJson("/api/admin/launch-dashboard", {
      cookie: adminCookie,
      env,
    });

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      recentAuditEvents: Array<{ action: string }>;
      summary: {
        activeUsers: number;
        groupsTotal: number;
        openReports: number;
        sessionsUpcoming: number;
        suspendedUsers: number;
        usersTotal: number;
      };
      timeline: Array<{ date: string; reportsCreated: number; signups: number }>;
    };

    expect(payload.summary.usersTotal).toBeGreaterThanOrEqual(3);
    expect(payload.summary.activeUsers).toBeGreaterThanOrEqual(2);
    expect(payload.summary.suspendedUsers).toBeGreaterThanOrEqual(1);
    expect(payload.summary.groupsTotal).toBeGreaterThanOrEqual(1);
    expect(payload.summary.sessionsUpcoming).toBeGreaterThanOrEqual(1);
    expect(payload.summary.openReports).toBeGreaterThanOrEqual(1);
    expect(payload.timeline.length).toBe(14);
    expect(payload.recentAuditEvents.some((event) => event.action === "group_created")).toBe(true);
  });
});

describe("moderation notification emails", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("sends reporter confirmation and operator alert emails when a report is created", async () => {
    const db = new SqliteD1Database();
    db.applyMigrations();
    const env = {
      ...createTestEnv(db as unknown as D1Database),
      RESEND_API_KEY: "test-resend-key",
    };
    const fetchSpy = mockEmailDelivery();

    await insertUser(env.DB, {
      displayName: "Reporter",
      email: "reporter@example.com",
      id: "user-reporter",
    });
    await insertUser(env.DB, {
      displayName: "Reported User",
      email: "target@example.com",
      id: "user-target",
    });
    const cookie = await makeSessionCookie(env.DB, "user-reporter");

    const response = await requestJson("/api/reports", {
      body: {
        note: "This felt unsafe.",
        reason: "safety_concern",
        targetId: "user-target",
        targetType: "profile",
      },
      cookie,
      env,
      method: "POST",
    });

    expect(response.status).toBe(201);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    const reporterEmailPayload = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
    const operatorEmailPayload = JSON.parse(String(fetchSpy.mock.calls[1]?.[1]?.body));

    expect(reporterEmailPayload.to).toBe("reporter@example.com");
    expect(reporterEmailPayload.subject).toBe("We received your Melon Meet report");
    expect(reporterEmailPayload.text).toContain("Profile: Reported User");

    expect(operatorEmailPayload.to).toEqual(["reviewer@example.com", "admin@example.com"]);
    expect(operatorEmailPayload.subject).toContain("New Melon Meet report");
    expect(operatorEmailPayload.text).toContain("Reporter: Reporter (reporter@example.com)");
    expect(operatorEmailPayload.text).toContain("Reporter note: This felt unsafe.");
  });

  it("sends review and suspension emails when an admin suspends a reported user", async () => {
    const db = new SqliteD1Database();
    db.applyMigrations();
    const env = {
      ...createTestEnv(db as unknown as D1Database),
      RESEND_API_KEY: "test-resend-key",
    };
    const fetchSpy = mockEmailDelivery();

    await insertUser(env.DB, {
      displayName: "Reporter",
      email: "reporter@example.com",
      id: "user-reporter",
    });
    await insertUser(env.DB, {
      displayName: "Reported User",
      email: "target@example.com",
      id: "user-target",
    });
    await insertUser(env.DB, {
      displayName: "Admin",
      email: "admin@example.com",
      id: "user-admin",
    });
    await insertProfileReport(env.DB, {
      id: "report-2",
      reporterUserId: "user-reporter",
      targetUserId: "user-target",
    });
    const adminCookie = await makeSessionCookie(env.DB, "user-admin");

    const response = await requestJson("/api/moderation/reports/report-2/actions", {
      body: {
        action: "suspend_user",
      },
      cookie: adminCookie,
      env,
      method: "POST",
    });

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    const reporterEmailPayload = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
    const suspendedUserEmailPayload = JSON.parse(String(fetchSpy.mock.calls[1]?.[1]?.body));

    expect(reporterEmailPayload.to).toBe("reporter@example.com");
    expect(reporterEmailPayload.subject).toBe("Your Melon Meet report was reviewed");
    expect(reporterEmailPayload.text).toContain("took action");

    expect(suspendedUserEmailPayload.to).toBe("target@example.com");
    expect(suspendedUserEmailPayload.subject).toBe("Your Melon Meet account has been suspended");
    expect(suspendedUserEmailPayload.text).toContain("Admin suspended the reported user account.");
  });

  it("sends a reporter outcome email when a report is closed without action", async () => {
    const db = new SqliteD1Database();
    db.applyMigrations();
    const env = {
      ...createTestEnv(db as unknown as D1Database),
      RESEND_API_KEY: "test-resend-key",
    };
    const fetchSpy = mockEmailDelivery();

    await insertUser(env.DB, {
      displayName: "Reporter",
      email: "reporter@example.com",
      id: "user-reporter",
    });
    await insertUser(env.DB, {
      displayName: "Reported User",
      email: "target@example.com",
      id: "user-target",
    });
    await insertUser(env.DB, {
      displayName: "Support Reviewer",
      email: "reviewer@example.com",
      id: "user-reviewer",
    });
    await insertProfileReport(env.DB, {
      id: "report-3",
      reporterUserId: "user-reporter",
      targetUserId: "user-target",
    });
    const cookie = await makeSessionCookie(env.DB, "user-reviewer");

    const response = await requestJson("/api/moderation/reports/report-3", {
      body: {
        resolution: "We reviewed this report and could not verify a policy violation from the available information.",
        status: "closed_no_action",
      },
      cookie,
      env,
      method: "PATCH",
    });

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const reporterEmailPayload = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
    expect(reporterEmailPayload.to).toBe("reporter@example.com");
    expect(reporterEmailPayload.subject).toBe("Your Melon Meet report was reviewed");
    expect(reporterEmailPayload.text).toContain("closed it without taking action");
    expect(reporterEmailPayload.text).toContain("could not verify a policy violation");
  });
});

describe("group and session notification emails", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("emails group owners and admins when a membership request is created", async () => {
    const db = new SqliteD1Database();
    db.applyMigrations();
    const env = {
      ...createTestEnv(db as unknown as D1Database),
      RESEND_API_KEY: "test-resend-key",
    };
    const fetchSpy = mockEmailDelivery();

    await insertUser(env.DB, { displayName: "Owner", email: "owner@example.com", id: "user-owner" });
    await insertUser(env.DB, { displayName: "Admin", email: "admin2@example.com", id: "user-admin2" });
    await insertUser(env.DB, { displayName: "Requester", email: "requester@example.com", id: "user-requester" });
    await insertGroup(env.DB, { id: "group-1", name: "Sunset Crew", ownerUserId: "user-owner", slug: "sunset-crew", visibility: "public" });
    await insertGroupMember(env.DB, { groupId: "group-1", role: "owner", userId: "user-owner" });
    await insertGroupMember(env.DB, { groupId: "group-1", role: "admin", userId: "user-admin2" });
    const cookie = await makeSessionCookie(env.DB, "user-requester");

    const response = await requestJson("/api/groups/group-1/membership-requests", {
      body: { note: "I can help organize weekday games." },
      cookie,
      env,
      method: "POST",
    });

    expect(response.status).toBe(201);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
    expect(payload.to).toEqual(["owner@example.com", "admin2@example.com"]);
    expect(payload.subject).toBe("New membership request for Sunset Crew");
    expect(payload.text).toContain("Requester: Requester (requester@example.com)");
    expect(payload.text).toContain("Note: I can help organize weekday games.");
  });

  it("emails remaining owners and admins when a member leaves a group", async () => {
    const db = new SqliteD1Database();
    db.applyMigrations();
    const env = {
      ...createTestEnv(db as unknown as D1Database),
      RESEND_API_KEY: "test-resend-key",
    };
    const fetchSpy = mockEmailDelivery();

    await insertUser(env.DB, { displayName: "Owner", email: "owner@example.com", id: "user-owner" });
    await insertUser(env.DB, { displayName: "Admin", email: "admin2@example.com", id: "user-admin2" });
    await insertUser(env.DB, { displayName: "Member", email: "member@example.com", id: "user-member" });
    await insertGroup(env.DB, { id: "group-2", name: "Morning Crew", ownerUserId: "user-owner", slug: "morning-crew", visibility: "public" });
    await insertGroupMember(env.DB, { groupId: "group-2", role: "owner", userId: "user-owner" });
    await insertGroupMember(env.DB, { groupId: "group-2", role: "admin", userId: "user-admin2" });
    await insertGroupMember(env.DB, { groupId: "group-2", role: "member", userId: "user-member" });
    const cookie = await makeSessionCookie(env.DB, "user-member");

    const response = await requestJson("/api/groups/group-2/membership", {
      cookie,
      env,
      method: "DELETE",
      origin: APP_BASE_URL,
    });

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
    expect(payload.to).toEqual(["owner@example.com", "admin2@example.com"]);
    expect(payload.subject).toBe("Member left Morning Crew");
    expect(payload.text).toContain("Previous role: member");
  });

  it("emails attendees other than the actor when a session is cancelled", async () => {
    const db = new SqliteD1Database();
    db.applyMigrations();
    const env = {
      ...createTestEnv(db as unknown as D1Database),
      RESEND_API_KEY: "test-resend-key",
    };
    const fetchSpy = mockEmailDelivery();

    await insertUser(env.DB, { displayName: "Owner", email: "owner@example.com", id: "user-owner" });
    await insertUser(env.DB, { displayName: "Attendee One", email: "one@example.com", id: "user-one" });
    await insertUser(env.DB, { displayName: "Attendee Two", email: "two@example.com", id: "user-two" });
    await insertGroup(env.DB, { id: "group-3", name: "City Nights", ownerUserId: "user-owner", slug: "city-nights", visibility: "public" });
    await insertGroupMember(env.DB, { groupId: "group-3", role: "owner", userId: "user-owner" });
    await insertMeeting(env.DB, { groupId: "group-3", id: "meeting-1", ownerUserId: "user-owner", title: "Thursday Sunset Rally" });
    await insertMeetingClaim(env.DB, { meetingId: "meeting-1", userId: "user-owner" });
    await insertMeetingClaim(env.DB, { meetingId: "meeting-1", userId: "user-one" });
    await insertMeetingClaim(env.DB, { meetingId: "meeting-1", userId: "user-two" });
    const cookie = await makeSessionCookie(env.DB, "user-owner");

    const response = await requestJson("/api/meetings/meeting-1/cancel", {
      cookie,
      env,
      method: "POST",
      origin: APP_BASE_URL,
    });

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
    expect(payload.to).toEqual(["one@example.com", "two@example.com"]);
    expect(payload.subject).toBe("Cancelled: Thursday Sunset Rally");
    expect(payload.text).toContain("Session: Thursday Sunset Rally");
    expect(payload.text).toContain("Location: Beach Court");
  });

  it("lets a signed-in user save notification preferences", async () => {
    const db = new SqliteD1Database();
    db.applyMigrations();
    const env = createTestEnv(db as unknown as D1Database);

    await insertUser(env.DB, { displayName: "Prefs User", email: "prefs@example.com", id: "user-prefs" });
    const cookie = await makeSessionCookie(env.DB, "user-prefs");

    const response = await requestJson("/api/me/notification-preferences", {
      body: {
        groupArchivedEmails: false,
        groupNewSessionEmails: true,
        groupMemberLeaveEmails: false,
        groupMembershipRequestEmails: true,
        moderationAndAccountEmails: false,
        sessionCancellationEmails: true,
        sessionChangeEmails: true,
        sessionPinboardEmails: false,
        sessionSpotClaimEmails: false,
        sessionSpotFilledEmails: false,
        sessionSpotReleaseEmails: true,
      },
      cookie,
      env,
      method: "PATCH",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      viewer: {
        notificationPreferences: {
          groupArchivedEmails: false,
          groupNewSessionEmails: true,
          groupMemberLeaveEmails: false,
          moderationAndAccountEmails: false,
          sessionChangeEmails: true,
          sessionPinboardEmails: false,
          sessionSpotClaimEmails: false,
          sessionSpotFilledEmails: false,
        },
      },
    });

    const row = await firstRow<{
      notification_group_member_leave_emails: number;
      notification_moderation_and_account_emails: number;
      notification_session_spot_claim_emails: number;
      notification_session_spot_filled_emails: number;
    }>(
      env.DB,
      `SELECT
         notification_group_member_leave_emails,
         notification_group_archived_emails,
         notification_group_new_session_emails,
         notification_moderation_and_account_emails,
         notification_session_change_emails,
         notification_session_pinboard_emails,
         notification_session_spot_claim_emails,
         notification_session_spot_filled_emails
       FROM users
       WHERE id = ?`,
      "user-prefs",
    );

    expect(row).toMatchObject({
      notification_group_member_leave_emails: 0,
      notification_group_archived_emails: 0,
      notification_group_new_session_emails: 1,
      notification_moderation_and_account_emails: 0,
      notification_session_change_emails: 1,
      notification_session_pinboard_emails: 0,
      notification_session_spot_claim_emails: 0,
      notification_session_spot_filled_emails: 0,
    });
  });
});

describe("session owner notification emails", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("emails the session owner when someone claims a spot, and uses the full-session email when the last spot is taken", async () => {
    const db = new SqliteD1Database();
    db.applyMigrations();
    const env = {
      ...createTestEnv(db as unknown as D1Database),
      RESEND_API_KEY: "test-resend-key",
    };
    const fetchSpy = mockEmailDelivery();

    await insertUser(env.DB, {
      displayName: "Owner",
      email: "owner@example.com",
      id: "user-owner",
      notificationPreferences: {
        sessionSpotClaimEmails: true,
        sessionSpotFilledEmails: true,
      },
    });
    await insertUser(env.DB, { displayName: "Claimer", email: "claimer@example.com", id: "user-claimer" });
    await insertUser(env.DB, { displayName: "Existing", email: "existing@example.com", id: "user-existing" });
    await insertGroup(env.DB, { id: "group-4", name: "After Work", ownerUserId: "user-owner", slug: "after-work", visibility: "public" });
    await insertGroupMember(env.DB, { groupId: "group-4", role: "owner", userId: "user-owner" });
    await insertMeeting(env.DB, { groupId: "group-4", id: "meeting-2", ownerUserId: "user-owner", title: "Evening Ladder" });
    await env.DB.prepare("UPDATE meetings SET capacity = ? WHERE id = ?").bind(2, "meeting-2").run();
    await insertMeetingClaim(env.DB, { meetingId: "meeting-2", userId: "user-existing" });
    const cookie = await makeSessionCookie(env.DB, "user-claimer");

    const response = await requestJson("/api/meetings/meeting-2/claim", {
      cookie,
      env,
      method: "POST",
      origin: APP_BASE_URL,
    });

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
    expect(payload.to).toBe("owner@example.com");
    expect(payload.subject).toBe("Evening Ladder is now full");
    expect(payload.text).toContain("Claimer claimed a spot");
    expect(payload.text).toContain("now full");
  });

  it("does not send spot-claim emails when the owner disables them", async () => {
    const db = new SqliteD1Database();
    db.applyMigrations();
    const env = {
      ...createTestEnv(db as unknown as D1Database),
      RESEND_API_KEY: "test-resend-key",
    };
    const fetchSpy = mockEmailDelivery();

    await insertUser(env.DB, {
      displayName: "Owner",
      email: "owner@example.com",
      id: "user-owner",
      notificationPreferences: {
        sessionSpotClaimEmails: false,
        sessionSpotFilledEmails: false,
      },
    });
    await insertUser(env.DB, { displayName: "Claimer", email: "claimer@example.com", id: "user-claimer" });
    await insertGroup(env.DB, { id: "group-5", name: "Open Gym", ownerUserId: "user-owner", slug: "open-gym", visibility: "public" });
    await insertGroupMember(env.DB, { groupId: "group-5", role: "owner", userId: "user-owner" });
    await insertMeeting(env.DB, { groupId: "group-5", id: "meeting-3", ownerUserId: "user-owner", title: "Saturday Open Gym" });
    const cookie = await makeSessionCookie(env.DB, "user-claimer");

    const response = await requestJson("/api/meetings/meeting-3/claim", {
      cookie,
      env,
      method: "POST",
      origin: APP_BASE_URL,
    });

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });

  it("emails the session owner when someone releases a claimed spot and the owner kept that switch on", async () => {
    const db = new SqliteD1Database();
    db.applyMigrations();
    const env = {
      ...createTestEnv(db as unknown as D1Database),
      RESEND_API_KEY: "test-resend-key",
    };
    const fetchSpy = mockEmailDelivery();

    await insertUser(env.DB, {
      displayName: "Owner",
      email: "owner@example.com",
      id: "user-owner",
      notificationPreferences: {
        sessionSpotReleaseEmails: true,
      },
    });
    await insertUser(env.DB, { displayName: "Releaser", email: "releaser@example.com", id: "user-releaser" });
    await insertGroup(env.DB, { id: "group-6", name: "Lunch Crew", ownerUserId: "user-owner", slug: "lunch-crew", visibility: "public" });
    await insertGroupMember(env.DB, { groupId: "group-6", role: "owner", userId: "user-owner" });
    await insertMeeting(env.DB, { groupId: "group-6", id: "meeting-4", ownerUserId: "user-owner", title: "Midday Rally" });
    await insertMeetingClaim(env.DB, { meetingId: "meeting-4", userId: "user-releaser" });
    const cookie = await makeSessionCookie(env.DB, "user-releaser");

    const response = await requestJson("/api/meetings/meeting-4/claim", {
      cookie,
      env,
      method: "DELETE",
      origin: APP_BASE_URL,
    });

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
    expect(payload.to).toBe("owner@example.com");
    expect(payload.subject).toBe("Spot released for Midday Rally");
    expect(payload.text).toContain("Releaser released their spot");
  });
});

describe("group member and attendee update emails", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("emails opted-in group members when a new session is added", async () => {
    const db = new SqliteD1Database();
    db.applyMigrations();
    const env = {
      ...createTestEnv(db as unknown as D1Database),
      RESEND_API_KEY: "test-resend-key",
    };
    const fetchSpy = mockEmailDelivery();

    await insertUser(env.DB, { displayName: "Owner", email: "owner@example.com", id: "user-owner" });
    await insertUser(env.DB, {
      displayName: "Member On",
      email: "member-on@example.com",
      id: "user-member-on",
      notificationPreferences: { groupNewSessionEmails: true },
    });
    await insertUser(env.DB, {
      displayName: "Member Off",
      email: "member-off@example.com",
      id: "user-member-off",
      notificationPreferences: { groupNewSessionEmails: false },
    });
    const groupId = "11111111-1111-4111-8111-111111111111";
    await insertGroup(env.DB, { id: groupId, name: "Riverside Crew", ownerUserId: "user-owner", slug: "riverside-crew", visibility: "public" });
    await insertGroupMember(env.DB, { groupId, role: "owner", userId: "user-owner" });
    await insertGroupMember(env.DB, { groupId, role: "member", userId: "user-member-on" });
    await insertGroupMember(env.DB, { groupId, role: "member", userId: "user-member-off" });
    const cookie = await makeSessionCookie(env.DB, "user-owner");

    const response = await requestJson("/api/meetings", {
      body: {
        activityLabel: "Beach volleyball",
        capacity: 12,
        costPerPerson: null,
        description: "Open training",
        endsAt: "2026-08-02T20:00:00.000Z",
        groupId,
        heroImageUrl: null,
        latitude: 52.52,
        locationAddress: "River Street 4",
        locationName: "River Courts",
        longitude: 13.405,
        pricing: "free",
        recurrence: { type: "once" },
        shortName: "river",
        startsAt: "2026-08-02T18:00:00.000Z",
        title: "Sunday Riverside Rally",
        venueId: null,
      },
      cookie,
      env,
      method: "POST",
    });

    expect(response.status).toBe(201);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
    expect(payload.to).toEqual(["member-on@example.com"]);
    expect(payload.subject).toBe("New session in Riverside Crew");
    expect(payload.text).toContain("Sunday Riverside Rally");
  });

  it("emails opted-in group members when a new session series is added", async () => {
    const db = new SqliteD1Database();
    db.applyMigrations();
    const env = {
      ...createTestEnv(db as unknown as D1Database),
      RESEND_API_KEY: "test-resend-key",
    };
    const fetchSpy = mockEmailDelivery();

    await insertUser(env.DB, { displayName: "Owner", email: "owner@example.com", id: "user-owner" });
    await insertUser(env.DB, { displayName: "Member", email: "member@example.com", id: "user-member" });
    const groupId = "22222222-2222-4222-8222-222222222222";
    await insertGroup(env.DB, { id: groupId, name: "Tuesday League", ownerUserId: "user-owner", slug: "tuesday-league", visibility: "public" });
    await insertGroupMember(env.DB, { groupId, role: "owner", userId: "user-owner" });
    await insertGroupMember(env.DB, { groupId, role: "member", userId: "user-member" });
    const cookie = await makeSessionCookie(env.DB, "user-owner");

    const response = await requestJson("/api/meetings", {
      body: {
        activityLabel: "Beach volleyball",
        capacity: 12,
        costPerPerson: null,
        description: "Weekly ladder",
        endsAt: "2026-08-04T20:00:00.000Z",
        groupId,
        heroImageUrl: null,
        latitude: 52.52,
        locationAddress: "League Street 7",
        locationName: "League Courts",
        longitude: 13.405,
        pricing: "free",
        recurrence: { type: "weekly", timezone: "Europe/Berlin", untilDate: "2026-09-01" },
        shortName: "league",
        startsAt: "2026-08-04T18:00:00.000Z",
        title: "Tuesday League Series",
        venueId: null,
      },
      cookie,
      env,
      method: "POST",
    });

    expect(response.status).toBe(201);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
    expect(payload.to).toEqual(["member@example.com"]);
    expect(payload.subject).toBe("New session series in Tuesday League");
    expect(payload.text).toContain("Tuesday League Series");
  });

  it("emails only opted-in attendees when a joined session changes meaningfully", async () => {
    const db = new SqliteD1Database();
    db.applyMigrations();
    const env = {
      ...createTestEnv(db as unknown as D1Database),
      RESEND_API_KEY: "test-resend-key",
    };
    const fetchSpy = mockEmailDelivery();

    await insertUser(env.DB, { displayName: "Owner", email: "owner@example.com", id: "user-owner" });
    await insertUser(env.DB, {
      displayName: "Attendee On",
      email: "attendee-on@example.com",
      id: "user-attendee-on",
      notificationPreferences: { sessionChangeEmails: true },
    });
    await insertUser(env.DB, {
      displayName: "Attendee Off",
      email: "attendee-off@example.com",
      id: "user-attendee-off",
      notificationPreferences: { sessionChangeEmails: false },
    });
    await insertGroup(env.DB, { id: "group-9", name: "Shift Crew", ownerUserId: "user-owner", slug: "shift-crew", visibility: "public" });
    await insertGroupMember(env.DB, { groupId: "group-9", role: "owner", userId: "user-owner" });
    await insertMeeting(env.DB, { groupId: "group-9", id: "meeting-5", ownerUserId: "user-owner", title: "Original Session" });
    await insertMeetingClaim(env.DB, { meetingId: "meeting-5", userId: "user-attendee-on" });
    await insertMeetingClaim(env.DB, { meetingId: "meeting-5", userId: "user-attendee-off" });
    const cookie = await makeSessionCookie(env.DB, "user-owner");

    const response = await requestJson("/api/meetings/meeting-5", {
      body: {
        title: "Updated Session",
      },
      cookie,
      env,
      method: "PATCH",
    });

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
    expect(payload.to).toEqual(["attendee-on@example.com"]);
    expect(payload.subject).toBe("Updated: Updated Session");
    expect(payload.text).toContain("A Melon Meet session you joined has changed.");
  });

  it("emails opted-in attendees when a new session pinboard update is posted", async () => {
    const db = new SqliteD1Database();
    db.applyMigrations();
    const env = {
      ...createTestEnv(db as unknown as D1Database),
      RESEND_API_KEY: "test-resend-key",
    };
    const fetchSpy = mockEmailDelivery();

    await insertUser(env.DB, { displayName: "Author", email: "author@example.com", id: "user-author" });
    await insertUser(env.DB, {
      displayName: "Attendee On",
      email: "attendee-on@example.com",
      id: "user-attendee-on",
      notificationPreferences: { sessionPinboardEmails: true },
    });
    await insertUser(env.DB, {
      displayName: "Attendee Off",
      email: "attendee-off@example.com",
      id: "user-attendee-off",
      notificationPreferences: { sessionPinboardEmails: false },
    });
    await insertGroup(env.DB, { id: "group-10", name: "Pinboard Crew", ownerUserId: "user-author", slug: "pinboard-crew", visibility: "public" });
    await insertGroupMember(env.DB, { groupId: "group-10", role: "owner", userId: "user-author" });
    await insertMeeting(env.DB, { groupId: "group-10", id: "meeting-6", ownerUserId: "user-author", title: "Pinboard Session" });
    await insertMeetingClaim(env.DB, { meetingId: "meeting-6", userId: "user-attendee-on" });
    await insertMeetingClaim(env.DB, { meetingId: "meeting-6", userId: "user-attendee-off" });
    const cookie = await makeSessionCookie(env.DB, "user-author");

    const response = await requestJson("/api/meetings/meeting-6/posts", {
      body: {
        content: "Court 2 is confirmed. Bring light layers.",
      },
      cookie,
      env,
      method: "POST",
    });

    expect(response.status).toBe(201);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
    expect(payload.to).toEqual(["attendee-on@example.com"]);
    expect(payload.subject).toBe("New update in Pinboard Session");
    expect(payload.text).toContain("new update on a Melon Meet session");
  });

  it("emails opted-in members when a group is archived", async () => {
    const db = new SqliteD1Database();
    db.applyMigrations();
    const env = {
      ...createTestEnv(db as unknown as D1Database),
      RESEND_API_KEY: "test-resend-key",
    };
    const fetchSpy = mockEmailDelivery();

    await insertUser(env.DB, { displayName: "Owner", email: "owner@example.com", id: "user-owner" });
    await insertUser(env.DB, {
      displayName: "Member On",
      email: "member-on@example.com",
      id: "user-member-on",
      notificationPreferences: { groupArchivedEmails: true },
    });
    await insertUser(env.DB, {
      displayName: "Member Off",
      email: "member-off@example.com",
      id: "user-member-off",
      notificationPreferences: { groupArchivedEmails: false },
    });
    const groupId = "33333333-3333-4333-8333-333333333333";
    await insertGroup(env.DB, { id: groupId, name: "Archive Crew", ownerUserId: "user-owner", slug: "archive-crew", visibility: "public" });
    await insertGroupMember(env.DB, { groupId, role: "owner", userId: "user-owner" });
    await insertGroupMember(env.DB, { groupId, role: "member", userId: "user-member-on" });
    await insertGroupMember(env.DB, { groupId, role: "member", userId: "user-member-off" });
    const cookie = await makeSessionCookie(env.DB, "user-owner");

    const response = await requestJson(`/api/groups/${groupId}`, {
      cookie,
      env,
      method: "DELETE",
      origin: APP_BASE_URL,
    });

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
    expect(payload.to).toEqual(["member-on@example.com"]);
    expect(payload.subject).toBe("Archived: Archive Crew");
    expect(payload.text).toContain("no longer active");
  });

  it("accepts a private invite link and returns the joined group id", async () => {
    const db = new SqliteD1Database();
    db.applyMigrations();
    const env = createTestEnv(db as unknown as D1Database);

    await insertUser(env.DB, { displayName: "Owner", email: "owner@example.com", id: "user-owner" });
    await insertUser(env.DB, { displayName: "Invitee", email: "invitee@example.com", id: "user-invitee" });
    await insertGroup(env.DB, { id: "group-invite", name: "Invite Crew", ownerUserId: "user-owner", slug: "invite-crew", visibility: "private" });
    await insertGroupMember(env.DB, { groupId: "group-invite", role: "owner", userId: "user-owner" });
    await env.DB.prepare(
      `INSERT INTO group_invite_links (id, group_id, code, created_by_user_id, expires_at, created_at)
       VALUES (?, ?, ?, ?, NULL, ?)`,
    )
      .bind("invite-link-1", "group-invite", "melon-secret", "user-owner", FIXED_NOW)
      .run();
    const cookie = await makeSessionCookie(env.DB, "user-invitee");

    const response = await requestJson("/api/groups/invite-links/melon-secret/accept", {
      cookie,
      env,
      method: "POST",
      origin: APP_BASE_URL,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      groupId: "group-invite",
      ok: true,
    });

    const membership = await firstRow<{ role: string }>(
      env.DB,
      `SELECT role
       FROM app_group_members
       WHERE group_id = ? AND user_id = ?`,
      "group-invite",
      "user-invitee",
    );
    expect(membership?.role).toBe("member");
  });
});

describe("signup policy acceptance tracking", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("stores the accepted privacy and terms versions on signup", async () => {
    const db = new SqliteD1Database();
    db.applyMigrations();
    const env = createTestEnv(db as unknown as D1Database);

    const response = await requestJson("/api/auth/signup", {
      baseUrl: LOCAL_BASE_URL,
      body: {
        acceptedAgeMinimum: true,
        acceptedPolicyVersions: CURRENT_POLICY_VERSIONS,
        email: "fresh@example.com",
        password: "melonmelon",
        turnstileToken: null,
      },
      env,
      method: "POST",
    });

    expect(response.status).toBe(201);

    const acceptedPolicies = await env.DB.prepare(
      `SELECT policy_name, policy_version
       FROM policy_acceptances
       ORDER BY policy_name ASC`,
    ).all<{ policy_name: string; policy_version: string }>();

    expect(acceptedPolicies.results).toEqual([
      {
        policy_name: "privacy",
        policy_version: CURRENT_POLICY_VERSIONS.privacy,
      },
      {
        policy_name: "terms",
        policy_version: CURRENT_POLICY_VERSIONS.terms,
      },
    ]);
  });
});

describe("local dev trusted origins", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("allows local frontend and local api origins to differ by port", async () => {
    const db = new SqliteD1Database();
    db.applyMigrations();
    const env = createTestEnv(db as unknown as D1Database);

    await insertUser(env.DB, {
      displayName: "Local Dev User",
      email: "local@example.com",
      id: "user-local-dev",
    });
    const cookie = await makeSessionCookie(env.DB, "user-local-dev");

    const response = await requestJson("/api/auth/logout", {
      baseUrl: LOCAL_BASE_URL,
      cookie,
      env,
      method: "POST",
      origin: "http://localhost:5173",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
    });
  });
});

describe("entity image galleries", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("lets owners save ordered galleries on their profile, group, and session", async () => {
    const db = new SqliteD1Database();
    db.applyMigrations();
    const env = createTestEnv(db as unknown as D1Database);
    await insertUser(env.DB, {
      displayName: "Gallery Owner",
      email: "gallery@example.com",
      id: "user-gallery-owner",
    });
    await insertGroup(env.DB, {
      id: "group-gallery",
      name: "Gallery Group",
      ownerUserId: "user-gallery-owner",
      slug: "gallery-group",
    });
    await insertGroupMember(env.DB, {
      groupId: "group-gallery",
      role: "owner",
      userId: "user-gallery-owner",
    });
    await insertMeeting(env.DB, {
      groupId: "group-gallery",
      id: "meeting-gallery",
      ownerUserId: "user-gallery-owner",
      title: "Gallery Session",
    });
    const cookie = await makeSessionCookie(env.DB, "user-gallery-owner");
    const imageUrls = [
      "https://images.example.com/first.jpg",
      "https://images.example.com/second.jpg",
    ];

    const profileResponse = await requestJson("/api/profiles/user-gallery-owner", {
      body: {
        avatarUrl: imageUrls[0],
        bio: "Gallery profile",
        displayName: "Gallery Owner",
        homeArea: "Berlin",
        imageUrls,
        isProfilePublic: true,
        playingLevel: "3.5",
        showEmailPublicly: false,
      },
      cookie,
      env,
      method: "PATCH",
    });
    expect(profileResponse.status).toBe(200);
    await expect(profileResponse.json()).resolves.toMatchObject({ profile: { imageUrls } });

    const groupResponse = await requestJson("/api/groups/group-gallery", {
      body: { heroImageUrl: imageUrls[0], imageUrls },
      cookie,
      env,
      method: "PATCH",
    });
    expect(groupResponse.status).toBe(200);
    const groupDetail = await requestJson("/api/groups/group-gallery", { cookie, env });
    await expect(groupDetail.json()).resolves.toMatchObject({ group: { imageUrls } });

    const meetingResponse = await requestJson("/api/meetings/meeting-gallery", {
      body: { heroImageUrl: imageUrls[0], imageUrls },
      cookie,
      env,
      method: "PATCH",
    });
    expect(meetingResponse.status).toBe(200);
    const meetingDetail = await requestJson("/api/meetings/meeting-gallery", { cookie, env });
    await expect(meetingDetail.json()).resolves.toMatchObject({ meeting: { imageUrls } });

    const stored = await env.DB.prepare(
      `SELECT
         (SELECT image_urls_json FROM users WHERE id = ?) AS profile_images,
         (SELECT image_urls_json FROM app_groups WHERE id = ?) AS group_images,
         (SELECT image_urls_json FROM meetings WHERE id = ?) AS meeting_images`,
    ).bind("user-gallery-owner", "group-gallery", "meeting-gallery").first<{
      group_images: string;
      meeting_images: string;
      profile_images: string;
    }>();
    expect(stored).toEqual({
      group_images: JSON.stringify(imageUrls),
      meeting_images: JSON.stringify(imageUrls),
      profile_images: JSON.stringify(imageUrls),
    });
  });
});

const venueAdminPayload = {
  accessType: "bookable",
  address: "Teststraße 1, 10115 Berlin",
  amenities: ["showers", "changing rooms"],
  bookingUrl: "https://booking.example.com/courts",
  courtCountTotal: 3,
  description: "A well maintained beach volleyball venue in central Berlin.",
  duplicateNotes: null,
  environment: "indoor_outdoor",
  facts: {
    areaNotes: ["Near the station"],
    equipment: ["fixed nets"],
    parkInspectorScore: 4.5,
    playerLevel: "All levels",
    surface: "Sand",
  },
  googleMapsUrl: "https://maps.example.com/test-venue",
  heroImageUrl: null,
  imageGallery: [],
  indoorCourtCount: 1,
  latitude: 52.52,
  longitude: 13.405,
  name: "Test Venue",
  openingHoursText: "Daily 09:00-22:00",
  outdoorCourtCount: 2,
  pricing: "paid",
  researchedAt: "2026-07-15T10:00:00.000Z",
  seasonalityText: "Open year-round.",
  sourceUrl: "https://example.com/test-venue",
  sourceUrls: ["https://example.com/test-venue"],
  websiteUrl: "https://example.com",
};

describe("venue administration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("rejects venue management access for regular signed-in users", async () => {
    const db = new SqliteD1Database();
    db.applyMigrations();
    const env = createTestEnv(db as unknown as D1Database);
    await insertUser(env.DB, {
      displayName: "Regular User",
      email: "member@example.com",
      id: "user-regular-venue",
    });
    const cookie = await makeSessionCookie(env.DB, "user-regular-venue");

    const response = await requestJson("/api/admin/venues", { cookie, env });

    expect(response.status).toBe(403);
  });

  it("lets admins create, edit, archive, and restore venues with an audit trail", async () => {
    const db = new SqliteD1Database();
    db.applyMigrations();
    const env = createTestEnv(db as unknown as D1Database);
    await insertUser(env.DB, {
      displayName: "Venue Admin",
      email: "admin@example.com",
      id: "user-venue-admin",
    });
    const cookie = await makeSessionCookie(env.DB, "user-venue-admin");

    const createResponse = await requestJson("/api/admin/venues", {
      body: { ...venueAdminPayload, id: "venue-test-courts" },
      cookie,
      env,
      method: "POST",
    });
    expect(createResponse.status).toBe(201);
    await expect(createResponse.json()).resolves.toMatchObject({
      venue: { id: "venue-test-courts", isArchived: false, name: "Test Venue" },
    });

    const updateResponse = await requestJson("/api/admin/venues/venue-test-courts", {
      body: { ...venueAdminPayload, name: "Updated Test Venue" },
      cookie,
      env,
      method: "PATCH",
    });
    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toMatchObject({
      venue: { id: "venue-test-courts", name: "Updated Test Venue" },
    });

    const archiveResponse = await requestJson("/api/admin/venues/venue-test-courts/archive", {
      body: { archived: true },
      cookie,
      env,
      method: "PATCH",
    });
    expect(archiveResponse.status).toBe(200);

    const publicResponse = await requestJson("/api/venues", { env });
    await expect(publicResponse.json()).resolves.toEqual({ venues: [] });

    const adminResponse = await requestJson("/api/admin/venues", { cookie, env });
    await expect(adminResponse.json()).resolves.toMatchObject({
      venues: [{ id: "venue-test-courts", isArchived: true }],
    });

    const restoreResponse = await requestJson("/api/admin/venues/venue-test-courts/archive", {
      body: { archived: false },
      cookie,
      env,
      method: "PATCH",
    });
    expect(restoreResponse.status).toBe(200);

    const actions = await env.DB.prepare(
      `SELECT action FROM audit_log_events
       WHERE target_type = 'venue' AND target_id = ?
       ORDER BY created_at ASC`,
    ).bind("venue-test-courts").all<{ action: string }>();
    expect(actions.results?.map((event) => event.action).sort()).toEqual(
      ["venue_created", "venue_updated", "venue_archived", "venue_restored"].sort(),
    );
  });
});
