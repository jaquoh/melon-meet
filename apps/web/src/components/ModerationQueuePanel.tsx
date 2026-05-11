import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Ban, Flag, Shield, Trash2, UserRoundCheck, UserX } from "lucide-react";
import { Link } from "react-router-dom";
import type { ModerationActionType, ModerationReportStatus, ModerationReportSummary, ViewerSummary } from "../../../../packages/shared/src";
import { executeModerationAction, getModerationReports, updateModerationReport } from "../lib/api";
import { queryClient } from "../lib/query-client";

const REPORT_STATUS_OPTIONS: Array<{ label: string; value: "action_taken" | "all" | "closed_no_action" | "open" | "triaged" }> = [
  { label: "Open", value: "open" },
  { label: "Triaged", value: "triaged" },
  { label: "Action taken", value: "action_taken" },
  { label: "Closed", value: "closed_no_action" },
  { label: "All", value: "all" },
];

const STATUS_EDIT_OPTIONS: Array<{ label: string; value: ModerationReportStatus }> = [
  { label: "Open", value: "open" },
  { label: "Triaged", value: "triaged" },
  { label: "Action taken", value: "action_taken" },
  { label: "Closed with no action", value: "closed_no_action" },
];

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function adminActionsForReport(report: ModerationReportSummary): Array<{ action: ModerationActionType; icon: typeof Ban; label: string }> {
  if (report.targetType === "profile") {
    return [{ action: "suspend_user", icon: UserX, label: "Suspend user" }];
  }
  if (report.targetType === "group") {
    return [
      { action: "archive_group", icon: Ban, label: "Archive group" },
      { action: "revoke_group_invite_links", icon: Trash2, label: "Revoke invite links" },
    ];
  }
  if (report.targetType === "meeting") {
    return [
      { action: "cancel_meeting", icon: Ban, label: "Cancel session" },
      { action: "archive_meeting", icon: Trash2, label: "Archive session" },
    ];
  }
  if (report.targetType === "group_post") {
    return [{ action: "remove_group_post", icon: Trash2, label: "Remove group post" }];
  }
  if (report.targetType === "meeting_post") {
    return [{ action: "remove_meeting_post", icon: Trash2, label: "Remove session post" }];
  }
  return [{ action: "revoke_group_invite_links", icon: Trash2, label: "Revoke invite links" }];
}

function ModerationReportCard({
  report,
  viewer,
}: {
  report: ModerationReportSummary;
  viewer: ViewerSummary;
}) {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<ModerationReportStatus>(report.status);
  const [internalNotes, setInternalNotes] = useState(report.internalNotes ?? "");
  const [resolution, setResolution] = useState(report.resolution ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStatus(report.status);
    setInternalNotes(report.internalNotes ?? "");
    setResolution(report.resolution ?? "");
    setError(null);
  }, [report]);

  const updateMutation = useMutation({
    mutationFn: (payload: {
      assigneeUserId?: string | null;
      internalNotes?: string | null;
      resolution?: string | null;
      status?: ModerationReportStatus;
    }) => updateModerationReport(report.id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === "moderation-reports",
      });
      setError(null);
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Could not update report.");
    },
  });
  const adminActionMutation = useMutation({
    mutationFn: (action: ModerationActionType) => executeModerationAction(report.id, action),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === "moderation-reports",
      });
      setError(null);
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Could not complete admin action.");
    },
  });

  const reporterLabel = `${report.reporter.displayName} (${report.reporter.email})`;
  const assigneeLabel = report.assignee ? `${report.assignee.displayName} (${report.assignee.email})` : "Unassigned";
  const adminActions = viewer.moderationRole === "admin" ? adminActionsForReport(report) : [];

  return (
    <article className="moderation-report-card stack-sm">
      <div className="moderation-report-card__header">
        <div className="stack-xs">
          <div className="moderation-report-card__badges">
            <span className="mini-chip">{report.status.replaceAll("_", " ")}</span>
            <span className="mini-chip mini-chip--muted">{report.reason.replaceAll("_", " ")}</span>
          </div>
          <strong>{report.targetLabel}</strong>
          <p className="muted-copy">
            Reported by {reporterLabel} on {formatTimestamp(report.createdAt)}
          </p>
        </div>
        <button className="button-secondary button-inline" onClick={() => setExpanded((current) => !current)} type="button">
          <Flag size={14} strokeWidth={2} />
          <span>{expanded ? "Hide review" : "Review"}</span>
        </button>
      </div>

      {report.note ? <p className="detail-quote">"{report.note}"</p> : <p className="muted-copy">No reporter note added.</p>}

      <div className="info-grid">
        <div>
          <span className="panel-caption">Assignee</span>
          <strong>{assigneeLabel}</strong>
        </div>
        <div>
          <span className="panel-caption">Last updated</span>
          <strong>{formatTimestamp(report.updatedAt)}</strong>
        </div>
      </div>

      {report.targetPath ? (
        <div className="subtle-action-row">
          <Link className="mini-link" to={report.targetPath}>
            Open reported item
          </Link>
        </div>
      ) : null}

      {expanded ? (
        <div className="moderation-report-card__editor stack-sm">
          <label className="stack-xs">
            <span className="panel-caption">Status</span>
            <select className="field-select" onChange={(event) => setStatus(event.target.value as ModerationReportStatus)} value={status}>
              {STATUS_EDIT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="stack-xs">
            <span className="panel-caption">Internal notes</span>
            <textarea
              className="field-area"
              onChange={(event) => setInternalNotes(event.target.value)}
              placeholder="Add reviewer notes for the queue."
              rows={4}
              value={internalNotes}
            />
          </label>

          <label className="stack-xs">
            <span className="panel-caption">Resolution</span>
            <input
              className="field-input"
              onChange={(event) => setResolution(event.target.value)}
              placeholder="Optional resolution summary"
              value={resolution}
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <div className="form-actions">
            <button
              className="button-primary"
              disabled={updateMutation.isPending || adminActionMutation.isPending}
              onClick={() =>
                updateMutation.mutate({
                  internalNotes,
                  resolution,
                  status,
                })
              }
              type="button"
            >
              {updateMutation.isPending ? "Saving..." : "Save review"}
            </button>
            <button
              className="button-secondary"
              disabled={updateMutation.isPending || adminActionMutation.isPending || report.assignee?.id === viewer.id}
              onClick={() =>
                updateMutation.mutate({
                  assigneeUserId: viewer.id,
                })
              }
              type="button"
            >
              <UserRoundCheck size={14} strokeWidth={2} />
              Assign to me
            </button>
            <button
              className="button-secondary"
              disabled={updateMutation.isPending || adminActionMutation.isPending || !report.assignee}
              onClick={() =>
                updateMutation.mutate({
                  assigneeUserId: null,
                })
              }
              type="button"
            >
              Unassign
            </button>
          </div>
          {adminActions.length > 0 ? (
            <div className="moderation-report-card__actions">
              <p className="panel-caption">Admin actions</p>
              <div className="form-actions">
                {adminActions.map((adminAction) => {
                  const Icon = adminAction.icon;
                  return (
                    <button
                      className="button-danger"
                      disabled={updateMutation.isPending || adminActionMutation.isPending}
                      key={adminAction.action}
                      onClick={() => adminActionMutation.mutate(adminAction.action)}
                      type="button"
                    >
                      <Icon size={14} strokeWidth={2} />
                      {adminAction.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function ModerationQueuePanel({ viewer }: { viewer: ViewerSummary }) {
  const [statusFilter, setStatusFilter] = useState<"action_taken" | "all" | "closed_no_action" | "open" | "triaged">("open");
  const reportsQuery = useQuery({
    queryFn: () => getModerationReports(statusFilter),
    queryKey: ["moderation-reports", statusFilter],
  });

  return (
    <div className="stack-panel moderation-queue">
      <div className="moderation-queue__header">
        <div className="stack-xs">
          <p className="panel-caption">Moderation queue</p>
          <h3 className="detail-title">Review incoming reports</h3>
          <p className="muted-copy">
            This is the minimum operator queue for launch: review, assign, add notes, and move reports through triage states.
          </p>
        </div>
        <span className="mini-chip">
          <Shield size={14} strokeWidth={2} />
          {viewer.moderationRole === "admin" ? "Admin" : "Support reviewer"}
        </span>
      </div>

      <div className="subtle-action-row">
        {REPORT_STATUS_OPTIONS.map((option) => (
          <button
            className={`button-secondary button-inline ${statusFilter === option.value ? "is-active" : ""}`.trim()}
            key={option.value}
            onClick={() => setStatusFilter(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>

      {reportsQuery.isLoading ? <p className="muted-copy">Loading moderation reports...</p> : null}
      {reportsQuery.isError ? <p className="form-error">{reportsQuery.error instanceof Error ? reportsQuery.error.message : "Could not load reports."}</p> : null}
      {!reportsQuery.isLoading && !reportsQuery.isError && reportsQuery.data?.reports.length === 0 ? (
        <p className="success-copy">No reports in this queue right now.</p>
      ) : null}
      {reportsQuery.data?.reports.map((report) => (
        <ModerationReportCard key={report.id} report={report} viewer={viewer} />
      ))}
    </div>
  );
}
