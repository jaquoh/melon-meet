import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Activity, BarChart3, KeyRound, RefreshCw, Shield } from "lucide-react";
import type { ViewerSummary } from "../../../../packages/shared/src";
import { bootstrapSmokeAccount, getLaunchDashboard } from "../lib/api";
import { CopyTextButton } from "./CopyTextButton";

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="launch-dashboard__metric-card">
      <span className="panel-caption">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function LaunchDashboardPanel({ viewer }: { viewer: ViewerSummary }) {
  const dashboardQuery = useQuery({
    queryFn: getLaunchDashboard,
    queryKey: ["launch-dashboard"],
    refetchInterval: 60_000,
  });
  const [smokeEmail, setSmokeEmail] = useState("");
  const [smokeDisplayName, setSmokeDisplayName] = useState("Smoke Test Operator");
  const [smokeStatus, setSmokeStatus] = useState<string | null>(null);
  const [latestPassword, setLatestPassword] = useState<string | null>(null);

  useEffect(() => {
    if (!dashboardQuery.data || smokeEmail) {
      return;
    }
    setSmokeEmail(`smoke-${dashboardQuery.data.environmentName}@melonmeet.local`);
  }, [dashboardQuery.data, smokeEmail]);

  const bootstrapMutation = useMutation({
    mutationFn: (payload: { displayName: string; email: string }) => bootstrapSmokeAccount(payload.email, payload.displayName),
    onSuccess: (response) => {
      setLatestPassword(response.generatedPassword);
      setSmokeStatus(
        response.account.created
          ? `Created ${response.account.email} and generated a fresh smoke-test password.`
          : `Reset ${response.account.email} and generated a fresh smoke-test password.`,
      );
    },
    onError: (error: Error) => {
      setLatestPassword(null);
      setSmokeStatus(error.message);
    },
  });

  const summary = dashboardQuery.data?.summary;
  const timelineMax = useMemo(() => {
    return Math.max(
      1,
      ...(dashboardQuery.data?.timeline.flatMap((entry) => [entry.signups, entry.meetingsCreated, entry.reportsCreated]) ?? [1]),
    );
  }, [dashboardQuery.data?.timeline]);

  return (
    <div className="stack-panel launch-dashboard">
      <div className="launch-dashboard__header">
        <div className="stack-sm">
          <p className="panel-caption">Launch dashboard</p>
          <h3 className="detail-title">Watch usage, signups, reports, and operator readiness</h3>
          <p className="muted-copy">
            This is a lightweight launch panel built on live app data: user creation, upcoming sessions, moderation pressure, and recent audit activity.
          </p>
        </div>
        <div className="subtle-action-row">
          <span className="mini-chip">
            <Shield size={14} strokeWidth={2} />
            {dashboardQuery.data?.viewerModerationRole === "admin" ? "Admin" : "Support reviewer"}
          </span>
          <button className="button-secondary button-inline" onClick={() => dashboardQuery.refetch()} type="button">
            <RefreshCw size={14} strokeWidth={2} />
            Refresh
          </button>
        </div>
      </div>

      {dashboardQuery.isLoading ? <p className="muted-copy">Loading launch metrics...</p> : null}
      {dashboardQuery.isError ? <p className="form-error">{dashboardQuery.error instanceof Error ? dashboardQuery.error.message : "Could not load launch metrics."}</p> : null}

      {summary ? (
        <>
          <div className="launch-dashboard__summary-grid">
            <MetricCard label="Users total" value={summary.usersTotal} />
            <MetricCard label="Verified users" value={summary.usersVerified} />
            <MetricCard label="New users (7d)" value={summary.usersCreatedLast7Days} />
            <MetricCard label="Active sessions" value={summary.activeSessions} />
            <MetricCard label="Upcoming sessions" value={summary.sessionsUpcoming} />
            <MetricCard label="Groups total" value={summary.groupsTotal} />
            <MetricCard label="Open reports" value={summary.openReports} />
            <MetricCard label="Pending requests" value={summary.pendingMembershipRequests} />
          </div>

          <div className="launch-dashboard__summary-grid">
            <MetricCard label="Suspended users" value={summary.suspendedUsers} />
            <MetricCard label="Deletion pending" value={summary.deletionPendingUsers} />
            <MetricCard label="Reports total" value={summary.reportsTotal} />
            <MetricCard label="Reports (7d)" value={summary.reportsCreatedLast7Days} />
            <MetricCard label="Meetings created (7d)" value={summary.meetingsCreatedLast7Days} />
            <MetricCard label="Invite links" value={summary.activeInviteLinks} />
            <MetricCard label="Venues total" value={summary.venuesTotal} />
            <MetricCard label="Private groups" value={summary.groupsPrivate} />
          </div>

          <div className="launch-dashboard__section">
            <div className="stack-sm">
              <p className="panel-caption">Last 14 days</p>
              <div className="launch-dashboard__timeline">
                {dashboardQuery.data?.timeline.map((entry) => (
                  <div className="launch-dashboard__timeline-row" key={entry.date}>
                    <span className="launch-dashboard__timeline-date">{entry.date}</span>
                    <div className="launch-dashboard__timeline-bars">
                      <div
                        className="launch-dashboard__timeline-bar launch-dashboard__timeline-bar--signups"
                        style={{ width: `${(entry.signups / timelineMax) * 100}%` }}
                        title={`Signups: ${entry.signups}`}
                      />
                      <div
                        className="launch-dashboard__timeline-bar launch-dashboard__timeline-bar--meetings"
                        style={{ width: `${(entry.meetingsCreated / timelineMax) * 100}%` }}
                        title={`Meetings: ${entry.meetingsCreated}`}
                      />
                      <div
                        className="launch-dashboard__timeline-bar launch-dashboard__timeline-bar--reports"
                        style={{ width: `${(entry.reportsCreated / timelineMax) * 100}%` }}
                        title={`Reports: ${entry.reportsCreated}`}
                      />
                    </div>
                    <span className="launch-dashboard__timeline-values">
                      {entry.signups}/{entry.meetingsCreated}/{entry.reportsCreated}
                    </span>
                  </div>
                ))}
              </div>
              <p className="field-hint">Each row is signups / meetings created / reports created.</p>
            </div>
          </div>

          <div className="launch-dashboard__section">
            <div className="stack-sm">
              <p className="panel-caption">Recent audit activity</p>
              <div className="launch-dashboard__event-list">
                {dashboardQuery.data?.recentAuditEvents.map((event) => (
                  <div className="launch-dashboard__event-card" key={event.id}>
                    <div className="stack-sm">
                      <strong>{event.summary}</strong>
                      <p className="muted-copy">
                        {event.actorDisplayName ?? "System"}{event.actorEmail ? ` (${event.actorEmail})` : ""} · {formatTimestamp(event.createdAt)}
                      </p>
                    </div>
                    <span className="mini-chip mini-chip--muted">{event.action}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {viewer.moderationRole === "admin" ? (
            <div className="launch-dashboard__section launch-dashboard__smoke-panel">
              <div className="stack-sm">
                <p className="panel-caption">Smoke account</p>
                <h4 className="section-title">Create or reset a launch-safe smoke user</h4>
                <p className="muted-copy">
                  This creates or resets an internal `@melonmeet.local` account, verifies the email immediately, and returns a one-time password you can use for authenticated smoke checks.
                </p>
              </div>
              <div className="stack-sm">
                <label className="field-stack">
                  <span className="field-label">Smoke email</span>
                  <input
                    className="field-input"
                    onChange={(event) => setSmokeEmail(event.target.value)}
                    placeholder="smoke-production@melonmeet.local"
                    value={smokeEmail}
                  />
                </label>
                <label className="field-stack">
                  <span className="field-label">Display name</span>
                  <input
                    className="field-input"
                    onChange={(event) => setSmokeDisplayName(event.target.value)}
                    placeholder="Smoke Test Operator"
                    value={smokeDisplayName}
                  />
                </label>
                <div className="form-actions">
                  <button
                    className="button-secondary"
                    disabled={bootstrapMutation.isPending || smokeEmail.trim().length === 0}
                    onClick={() => {
                      setSmokeStatus(null);
                      setLatestPassword(null);
                      bootstrapMutation.mutate({
                        displayName: smokeDisplayName,
                        email: smokeEmail,
                      });
                    }}
                    type="button"
                  >
                    <KeyRound size={14} strokeWidth={2} />
                    {bootstrapMutation.isPending ? "Generating..." : "Bootstrap smoke account"}
                  </button>
                </div>
                {smokeStatus ? (
                  <p className={latestPassword ? "success-copy" : "form-error"}>{smokeStatus}</p>
                ) : null}
                {latestPassword ? (
                  <div className="launch-dashboard__smoke-result">
                    <div className="stack-sm">
                      <p className="muted-copy">Use these values for `SMOKE_EMAIL_PRODUCTION` / `SMOKE_PASSWORD_PRODUCTION` or the staging equivalents.</p>
                      <p className="launch-dashboard__secret">{smokeEmail}</p>
                      <p className="launch-dashboard__secret">{latestPassword}</p>
                    </div>
                    <div className="subtle-action-row">
                      <CopyTextButton label="Copy email" value={smokeEmail} />
                      <CopyTextButton label="Copy password" value={latestPassword} />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
