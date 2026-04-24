import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";
import type { ViewerSummary } from "../../../../packages/shared/src";
import { firstRow, runStatement } from "./db";
import type { AppEnv } from "../types/env";

const SESSION_COOKIE_NAME = "melon_meet_session";
const PBKDF2_ITERATIONS = 210_000;

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

async function sha256(value: string) {
  const input = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return bytesToBase64Url(new Uint8Array(digest));
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
  const rawToken = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256(rawToken);
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

  const tokenHash = await sha256(rawToken);
  await runStatement(db, "DELETE FROM sessions WHERE token_hash = ?", tokenHash);
}

export async function resolveSessionViewer(
  db: D1Database,
  rawToken: string | null,
): Promise<{ sessionId: string; viewer: ViewerSummary } | null> {
  if (!rawToken) {
    return null;
  }

  const tokenHash = await sha256(rawToken);
  const row = await firstRow<{
    session_id: string;
    id: string;
    email: string;
    display_name: string;
    bio: string;
    home_area: string;
    playing_level: string;
    avatar_url: string | null;
    is_profile_public: number;
    show_email_publicly: number;
  }>(
    db,
    `SELECT
       sessions.id AS session_id,
       users.id,
       users.email,
       users.display_name,
       users.bio,
       users.home_area,
       users.playing_level,
       users.avatar_url,
       users.is_profile_public,
       users.show_email_publicly
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ?
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
      homeArea: row.home_area,
      id: row.id,
      playingLevel: row.playing_level,
      isProfilePublic: Boolean(row.is_profile_public),
      showEmailPublicly: Boolean(row.show_email_publicly),
    },
  };
}

export function readSessionCookie(c: Context<AppEnv>) {
  return getCookie(c, SESSION_COOKIE_NAME) ?? null;
}
