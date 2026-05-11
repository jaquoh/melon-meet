import { runStatement } from "./db";

export async function writeAuditLogEvent(
  db: D1Database,
  options: {
    action: string;
    actorUserId?: string | null;
    metadata?: Record<string, unknown>;
    summary: string;
    targetId: string;
    targetType: string;
  },
) {
  await runStatement(
    db,
    `INSERT INTO audit_log_events (
       id, actor_user_id, action, target_type, target_id, summary, metadata_json, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    crypto.randomUUID(),
    options.actorUserId ?? null,
    options.action,
    options.targetType,
    options.targetId,
    options.summary,
    options.metadata ? JSON.stringify(options.metadata) : null,
    new Date().toISOString(),
  );
}
