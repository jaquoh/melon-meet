import { firstRow, runStatement } from "./db";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

interface ConsumeRateLimitOptions {
  identifier: string;
  limit: number;
  now?: Date;
  scope: string;
  windowMs: number;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let value = "";
  for (const byte of bytes) {
    value += String.fromCharCode(byte);
  }
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256(value: string) {
  const input = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return bytesToBase64Url(new Uint8Array(digest));
}

export function floorToRateLimitWindow(now: Date, windowMs: number) {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

export function retryAfterSeconds(now: Date, bucketStart: Date, windowMs: number) {
  return Math.max(1, Math.ceil((bucketStart.getTime() + windowMs - now.getTime()) / 1000));
}

async function cleanupExpiredBuckets(db: D1Database, now: Date, windowMs: number) {
  const cutoff = new Date(now.getTime() - windowMs * 6).toISOString();
  await runStatement(db, "DELETE FROM auth_rate_limits WHERE bucket_start < ?", cutoff);
}

export async function consumeRateLimit(
  db: D1Database,
  { identifier, limit, now = new Date(), scope, windowMs }: ConsumeRateLimitOptions,
): Promise<RateLimitResult> {
  const bucketStart = floorToRateLimitWindow(now, windowMs);
  const bucketStartIso = bucketStart.toISOString();
  const keyHash = await sha256(`${scope}:${identifier}`);
  const existing = await firstRow<{ attempt_count: number }>(
    db,
    `SELECT attempt_count
     FROM auth_rate_limits
     WHERE key_hash = ?
       AND bucket_start = ?`,
    keyHash,
    bucketStartIso,
  );

  const currentAttempts = Number(existing?.attempt_count ?? 0);
  const waitSeconds = retryAfterSeconds(now, bucketStart, windowMs);

  if (currentAttempts >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: waitSeconds,
    };
  }

  if (currentAttempts > 0) {
    await runStatement(
      db,
      `UPDATE auth_rate_limits
       SET attempt_count = attempt_count + 1,
           last_attempt_at = ?
       WHERE key_hash = ?
         AND bucket_start = ?`,
      now.toISOString(),
      keyHash,
      bucketStartIso,
    );
  } else {
    await runStatement(
      db,
      `INSERT INTO auth_rate_limits (key_hash, scope, bucket_start, attempt_count, last_attempt_at)
       VALUES (?, ?, ?, 1, ?)`,
      keyHash,
      scope,
      bucketStartIso,
      now.toISOString(),
    );
  }

  if (Math.random() < 0.05) {
    await cleanupExpiredBuckets(db, now, windowMs);
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - currentAttempts - 1),
    retryAfterSeconds: waitSeconds,
  };
}
