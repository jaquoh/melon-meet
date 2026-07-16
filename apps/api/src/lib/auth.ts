import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";
import { DEFAULT_NOTIFICATION_PREFERENCES, type ViewerSummary } from "../../../../packages/shared/src";
import { firstRow, runStatement } from "./db";
import type { AppEnv } from "../types/env";

const SESSION_COOKIE_NAME = "melon_meet_session";
const PBKDF2_ITERATIONS = 100_000;

function bytesToBase64Url(bytes: Uint8Array) {
  let value = "";
  for (const byte of bytes) {
    value += String.fromCharCode(byte);
  }
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function parseImageUrls(primaryUrl: string | null, value: string | null) {
  let parsed: unknown = [];
  try {
    parsed = JSON.parse(value ?? "[]");
  } catch {
    parsed = [];
  }
  const candidates = [primaryUrl, ...(Array.isArray(parsed) ? parsed : [])];
  return candidates.filter(
    (entry, index): entry is string => typeof entry === "string" && entry.length > 0 && candidates.indexOf(entry) === index,
  );
}

async function sha256(value: string) {
  const input = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return bytesToBase64Url(new Uint8Array(digest));
}

export function generateOpaqueToken() {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function hashOpaqueToken(value: string) {
  return sha256(value);
}

async function derivePasswordHash(password: string, saltBytes: Uint8Array) {
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      hash: "SHA-256",
      iterations: PBKDF2_ITERATIONS,
      name: "PBKDF2",
      salt: toArrayBuffer(saltBytes),
    },
    passwordKey,
    256,
  );

  return bytesToBase64Url(new Uint8Array(bits));
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePasswordHash(password, salt);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToBase64Url(salt)}$${hash}`;
}

export async function verifyPassword(password: string, encodedHash: string) {
  const [algorithm, iterationValue, saltValue, hashValue] = encodedHash.split("$");
  if (algorithm !== "pbkdf2" || !iterationValue || !saltValue || !hashValue) {
    return false;
  }

  const iterations = Number(iterationValue);
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const derived = await crypto.subtle.deriveBits(
    {
      hash: "SHA-256",
      iterations,
      name: "PBKDF2",
      salt: toArrayBuffer(base64UrlToBytes(saltValue)),
    },
    passwordKey,
    256,
  );

  return bytesToBase64Url(new Uint8Array(derived)) === hashValue;
}

export async function createSession(
  db: D1Database,
  userId: string,
) {
  const sessionId = crypto.randomUUID();
  const rawToken = generateOpaqueToken();
  const tokenHash = await hashOpaqueToken(rawToken);
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();

  await runStatement(
    db,
    `INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    sessionId,
    userId,
    tokenHash,
    expiresAt,
    createdAt,
  );

  return { expiresAt, sessionId, token: rawToken };
}

export function writeSessionCookie(c: Context<AppEnv>, token: string, expiresAt: string) {
  setCookie(c, SESSION_COOKIE_NAME, token, {
    expires: new Date(expiresAt),
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "Lax",
    secure: true,
  });
}

export function clearSessionCookie(c: Context<AppEnv>) {
  deleteCookie(c, SESSION_COOKIE_NAME, {
    path: "/",
  });
}

export async function revokeSessionByToken(db: D1Database, rawToken: string | null) {
  if (!rawToken) {
    return;
  }

  const tokenHash = await hashOpaqueToken(rawToken);
  await runStatement(db, "DELETE FROM sessions WHERE token_hash = ?", tokenHash);
}

export async function revokeAllSessionsForUser(db: D1Database, userId: string) {
  await runStatement(db, "DELETE FROM sessions WHERE user_id = ?", userId);
}

export async function revokeOtherSessionsForUser(db: D1Database, userId: string, currentSessionId: string | null) {
  if (!currentSessionId) {
    await revokeAllSessionsForUser(db, userId);
    return;
  }

  await runStatement(
    db,
    "DELETE FROM sessions WHERE user_id = ? AND id != ?",
    userId,
    currentSessionId,
  );
}

export async function resolveSessionViewer(
  db: D1Database,
  rawToken: string | null,
): Promise<{ sessionId: string; viewer: ViewerSummary } | null> {
  if (!rawToken) {
    return null;
  }

  const tokenHash = await hashOpaqueToken(rawToken);
  const row = await firstRow<{
    account_status: string;
    session_id: string;
    id: string;
    email: string;
    email_verified_at: string | null;
    display_name: string;
    bio: string;
    home_area: string;
    playing_level: string;
    avatar_url: string | null;
    image_urls_json: string | null;
    is_profile_public: number;
    show_email_publicly: number;
    notification_moderation_and_account_emails: number;
    notification_group_membership_request_emails: number;
    notification_group_member_leave_emails: number;
    notification_group_new_session_emails: number;
    notification_group_archived_emails: number;
    notification_session_cancellation_emails: number;
    notification_session_change_emails: number;
    notification_session_pinboard_emails: number;
    notification_session_spot_claim_emails: number;
    notification_session_spot_release_emails: number;
    notification_session_spot_filled_emails: number;
  }>(
    db,
    `SELECT
       sessions.id AS session_id,
       users.account_status,
       users.id,
       users.email,
       users.email_verified_at,
       users.display_name,
       users.bio,
       users.home_area,
       users.playing_level,
       users.avatar_url,
       users.image_urls_json,
       users.is_profile_public,
       users.show_email_publicly,
       users.notification_moderation_and_account_emails,
       users.notification_group_membership_request_emails,
       users.notification_group_member_leave_emails,
       users.notification_group_new_session_emails,
       users.notification_group_archived_emails,
       users.notification_session_cancellation_emails,
       users.notification_session_change_emails,
       users.notification_session_pinboard_emails,
       users.notification_session_spot_claim_emails,
       users.notification_session_spot_release_emails,
       users.notification_session_spot_filled_emails
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ?
       AND users.account_status = 'active'
       AND sessions.expires_at > ?`,
    tokenHash,
    new Date().toISOString(),
  );

  if (!row) {
    return null;
  }

  return {
    sessionId: row.session_id,
    viewer: {
      avatarUrl: row.avatar_url,
      bio: row.bio,
      displayName: row.display_name,
      email: row.email,
      emailVerified: Boolean(row.email_verified_at),
      homeArea: row.home_area,
      id: row.id,
      imageUrls: parseImageUrls(row.avatar_url, row.image_urls_json),
      moderationRole: null,
      notificationPreferences: {
        groupArchivedEmails: Boolean(row.notification_group_archived_emails ?? DEFAULT_NOTIFICATION_PREFERENCES.groupArchivedEmails),
        groupNewSessionEmails: Boolean(row.notification_group_new_session_emails ?? DEFAULT_NOTIFICATION_PREFERENCES.groupNewSessionEmails),
        groupMemberLeaveEmails: Boolean(row.notification_group_member_leave_emails ?? DEFAULT_NOTIFICATION_PREFERENCES.groupMemberLeaveEmails),
        groupMembershipRequestEmails: Boolean(row.notification_group_membership_request_emails ?? DEFAULT_NOTIFICATION_PREFERENCES.groupMembershipRequestEmails),
        moderationAndAccountEmails: Boolean(row.notification_moderation_and_account_emails ?? DEFAULT_NOTIFICATION_PREFERENCES.moderationAndAccountEmails),
        sessionCancellationEmails: Boolean(row.notification_session_cancellation_emails ?? DEFAULT_NOTIFICATION_PREFERENCES.sessionCancellationEmails),
        sessionChangeEmails: Boolean(row.notification_session_change_emails ?? DEFAULT_NOTIFICATION_PREFERENCES.sessionChangeEmails),
        sessionPinboardEmails: Boolean(row.notification_session_pinboard_emails ?? DEFAULT_NOTIFICATION_PREFERENCES.sessionPinboardEmails),
        sessionSpotClaimEmails: Boolean(row.notification_session_spot_claim_emails ?? DEFAULT_NOTIFICATION_PREFERENCES.sessionSpotClaimEmails),
        sessionSpotFilledEmails: Boolean(row.notification_session_spot_filled_emails ?? DEFAULT_NOTIFICATION_PREFERENCES.sessionSpotFilledEmails),
        sessionSpotReleaseEmails: Boolean(row.notification_session_spot_release_emails ?? DEFAULT_NOTIFICATION_PREFERENCES.sessionSpotReleaseEmails),
      },
      playingLevel: row.playing_level,
      isProfilePublic: Boolean(row.is_profile_public),
      showEmailPublicly: Boolean(row.show_email_publicly),
    },
  };
}

export function readSessionCookie(c: Context<AppEnv>) {
  return getCookie(c, SESSION_COOKIE_NAME) ?? null;
}
