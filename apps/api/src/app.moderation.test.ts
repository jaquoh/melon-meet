import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "./app";
import { createSession, hashOpaqueToken } from "./lib/auth";
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

async function insertUser(
  db: D1Database,
  {
    displayName,
    email,
    id,
    status = "active",
  }: {
    displayName: string;
    email: string;
    id: string;
    status?: "active" | "deletion-pending" | "suspended";
  },
) {
  await db.prepare(
    `INSERT INTO users (
       id, email, password_hash, display_name, bio, home_area, avatar_url,
       created_at, updated_at, is_profile_public, show_email_publicly,
       playing_level, email_verified_at, account_status,
       deletion_requested_at, deleted_at
     ) VALUES (?, ?, ?, ?, '', '', NULL, ?, ?, 0, 0, '', ?, ?, NULL, NULL)`,
  )
    .bind(id, email, "test-password-hash", displayName, FIXED_NOW, FIXED_NOW, FIXED_NOW, status)
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
    method?: "GET" | "PATCH" | "POST";
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
