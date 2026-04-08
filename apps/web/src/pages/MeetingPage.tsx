import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CircleDollarSign, Clock3, MapPinned, Shield, Users } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import type { ViewerSummary } from "../../../../packages/shared/src";
import type { ThemeMode } from "../App";
import { CopyTextButton } from "../components/CopyTextButton";
import { DetailHero } from "../components/DetailHero";
import { MeetingForm } from "../components/MeetingForm";
import { PostBoard } from "../components/PostBoard";
import { WorkspaceShell } from "../components/WorkspaceShell";
import {
  cancelMeeting,
  claimMeeting,
  createMeetingPost,
  createMeeting,
  deleteMeeting,
  getGroups,
  getMeeting,
  unclaimMeeting,
  updateMeeting,
} from "../lib/api";
import { formatDateTime } from "../lib/format";
import { resolveNavigationState } from "../lib/navigation";
import { queryClient } from "../lib/query-client";

export function MeetingPage({
  onLogOut,
  theme,
  toggleTheme,
  viewer,
}: {
  onLogOut: () => void;
  theme: ThemeMode;
  toggleTheme: () => void;
  viewer: ViewerSummary | null;
}) {
  const { meetingId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [editingMode, setEditingMode] = useState<"series" | "single" | null>(null);

  const meetingQuery = useQuery({
    queryFn: () => getMeeting(meetingId),
    queryKey: ["meeting", meetingId],
  });
  const groupsQuery = useQuery({
    queryFn: getGroups,
    queryKey: ["groups"],
  });
  const claimMutation = useMutation({
    mutationFn: (claimed: boolean) => (claimed ? unclaimMeeting(meetingId) : claimMeeting(meetingId)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["meeting", meetingId] });
      await queryClient.invalidateQueries({ queryKey: ["map"] });
    },
  });
  const cancelMutation = useMutation({
    mutationFn: () => cancelMeeting(meetingId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["meeting", meetingId] });
    },
  });
  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => updateMeeting(meetingId, payload),
    onSuccess: async () => {
      setEditingMode(null);
      await queryClient.invalidateQueries({ queryKey: ["meeting", meetingId] });
      await queryClient.invalidateQueries({ queryKey: ["map"] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteMeeting(meetingId),
  });
  const postMutation = useMutation({
    mutationFn: (content: string) => createMeetingPost(meetingId, content),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["meeting", meetingId] });
    },
  });

  if (meetingQuery.isLoading) {
    return <div className="loading-shell">Loading session...</div>;
  }

  if (meetingQuery.isError || !meetingQuery.data) {
    return <div className="error-shell">{meetingQuery.error?.message ?? "Session not found."}</div>;
  }

  const { claims, meeting, posts, seriesMeetings, viewerGroupRole } = meetingQuery.data;
  const canManage = meeting.viewerCanEdit || viewerGroupRole === "owner" || viewerGroupRole === "admin";
  const closeTarget = resolveNavigationState(location.state, "/sessions", "Sessions");
  const editing = editingMode !== null;
  const editingSeries = editingMode === "series";

  async function handleMeetingSave(payload: Record<string, unknown>) {
    const { seriesDates, ...basePayload } = payload as Record<string, unknown> & {
      seriesDates?: Array<{ endsAt: string; startsAt: string }>;
    };

    if (editingSeries) {
      await updateMutation.mutateAsync({
        ...basePayload,
        applyToSeries: true,
        seriesDates,
      });
      return;
    }

    if (!seriesDates || seriesDates.length === 0) {
      await updateMutation.mutateAsync(basePayload);
      return;
    }

    const sortedDates = [...seriesDates].sort(
      (left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
    );
    const [primary, ...rest] = sortedDates;
    await updateMutation.mutateAsync({
      ...basePayload,
      endsAt: primary.endsAt,
      startsAt: primary.startsAt,
    });

    for (const slot of rest) {
      await createMeeting({
        activityLabel: basePayload.activityLabel,
        capacity: basePayload.capacity,
        costPerPerson: basePayload.costPerPerson,
        description: basePayload.description,
        endsAt: slot.endsAt,
        groupId: meeting.groupId,
        heroImageUrl: basePayload.heroImageUrl,
        latitude: basePayload.latitude,
        locationAddress: basePayload.locationAddress,
        locationName: basePayload.locationName,
        longitude: basePayload.longitude,
        pricing: basePayload.pricing,
        recurrence: { type: "once" },
        shortName: basePayload.shortName,
        startsAt: slot.startsAt,
        title: basePayload.title,
        venueId: basePayload.venueId,
      });
    }
    await queryClient.invalidateQueries({ queryKey: ["map"] });
  }

  async function handleDelete() {
    if (!window.confirm("Delete this session? This cannot be undone.")) {
      return;
    }
    await deleteMutation.mutateAsync();
    navigate(closeTarget.fromPath);
  }

  async function handleCancelSession() {
    if (!window.confirm("Cancel this session? It will stay visible, but marked as cancelled.")) {
      return;
    }
    await cancelMutation.mutateAsync();
  }

  return (
    <WorkspaceShell
      center={
        <div className="workspace-detail-scroll">
          <div className="stack-panel">
          {editing ? (
            <>
              <div className="screen-heading">
                <h2 className="screen-heading__title">{editingSeries ? "Edit: Session Series" : "Edit: Session"}</h2>
              </div>
              <MeetingForm
                formId="meeting-edit-form"
                groups={groupsQuery.data?.groups ?? []}
                initialMeeting={meeting}
                initialSeriesDates={seriesMeetings.map((entry) => ({ endsAt: entry.endsAt, startsAt: entry.startsAt }))}
                onSubmit={handleMeetingSave}
                seriesMode={editingSeries}
              />
              <div className="editor-action-row">
                {!editingSeries ? (
                  <button className="button-danger editor-action-row__danger" onClick={handleDelete} type="button">
                    Delete session
                  </button>
                ) : null}
                <div className="editor-action-row__right">
                  <button className="button-secondary" onClick={() => setEditingMode(null)} type="button">
                    Cancel
                  </button>
                  <button className="button-primary" form="meeting-edit-form" type="submit">
                    {editingSeries ? "Save all sessions" : "Save session"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <DetailHero
                description={meeting.description || "No description yet."}
                eyebrow="Session"
                imageUrl={meeting.heroImageUrl}
                meta={
                  <>
                    {meeting.status === "cancelled" ? <span className="badge-cancelled">Cancelled</span> : null}
                    <span className="mini-chip">{meeting.shortName}</span>
                    <span className="mini-chip">{formatDateTime(meeting.startsAt)}</span>
                    <span className="mini-chip">
                      {meeting.pricing === "free"
                        ? "Free"
                        : meeting.costPerPerson
                          ? `${meeting.costPerPerson}€ / person`
                          : "Shared costs"}
                    </span>
                  </>
                }
                titleClassName={meeting.status === "cancelled" ? "session-title--cancelled" : undefined}
                title={meeting.title}
              >
                <CopyTextButton label="Copy address" value={meeting.locationAddress} />
                <a
                  className="button-secondary button-inline"
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(meeting.locationAddress)}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  <MapPinned size={14} strokeWidth={2} />
                  <span>Open maps</span>
                </a>
              </DetailHero>
              <div className="detail-fact-grid">
                <article className="detail-fact-card">
                  <span className="panel-caption">Time</span>
                  <strong>{formatDateTime(meeting.startsAt)}</strong>
                </article>
                <article className="detail-fact-card">
                  <span className="panel-caption">Venue</span>
                  <strong>{meeting.locationName}</strong>
                </article>
                <article className="detail-fact-card">
                  <span className="panel-caption">Access</span>
                  <strong>
                    {meeting.pricing === "free"
                      ? "Free to join"
                      : meeting.costPerPerson
                        ? `${meeting.costPerPerson}€ / person`
                        : "Estimated shared costs"}
                  </strong>
                </article>
              </div>
              <PostBoard
                buttonLabel="Post update"
                canPost={Boolean(viewer)}
                emptyLabel="No updates yet."
                onSubmit={async (content) => postMutation.mutateAsync(content)}
                posts={posts}
                title="Pin board"
              />
            </>
          )}
          </div>
        </div>
      }
      detailCloseTo={closeTarget.fromPath}
      left={
        <div className="stack-panel">
          <div className="detail-card detail-card--compact">
            <span className="panel-caption">Availability</span>
            <strong>{meeting.claimedSpots}/{meeting.capacity} occupied</strong>
            {meeting.viewerHasClaimed ? <span className="mini-chip mini-chip--accent">Attending</span> : null}
          </div>
          {viewer ? (
            <button className="button-primary" onClick={() => claimMutation.mutate(meeting.viewerHasClaimed)} type="button">
              <Users size={14} strokeWidth={2} />
              {meeting.viewerHasClaimed ? "Release spot" : "Claim spot"}
            </button>
          ) : null}
          <a
            className="button-secondary"
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(meeting.locationAddress)}`}
            rel="noreferrer"
            target="_blank"
          >
            <MapPinned size={14} strokeWidth={2} />
            Open in Google Maps
          </a>
          <CopyTextButton label="Copy address" value={meeting.locationAddress} />
          <div className="detail-card detail-card--compact">
            <span className="panel-caption">Practical</span>
            <div className="detail-meta-list">
              <span><Clock3 size={14} strokeWidth={2} />{meeting.locationName}</span>
              <span>
                <CircleDollarSign size={14} strokeWidth={2} />
                {meeting.pricing === "free"
                  ? "Free"
                  : meeting.costPerPerson
                    ? `${meeting.costPerPerson}€ / person`
                    : "Shared costs"}
              </span>
            </div>
          </div>
          <div className="detail-card detail-card--compact">
            <span className="panel-caption">Roster</span>
            <div className="detail-link-list">
              {claims.map((claim) => (
                <Link className="mini-link" key={claim.id} to={`/profile/${claim.id}`}>
                  {claim.displayName}
                </Link>
              ))}
            </div>
          </div>
          {canManage ? (
            <>
              <button
                className="button-secondary"
                onClick={() => setEditingMode((current) => (current === "single" ? null : "single"))}
                type="button"
              >
                <Shield size={14} strokeWidth={2} />
                {editingMode === "single" ? "Close edit" : "Edit session"}
              </button>
              {meeting.seriesId ? (
                <button className="button-secondary" onClick={() => setEditingMode((current) => (current === "series" ? null : "series"))} type="button">
                  <Shield size={14} strokeWidth={2} />
                  {editingMode === "series" ? "Close series edit" : "Edit series"}
                </button>
              ) : null}
              <button className="button-danger" onClick={handleCancelSession} type="button">
                Cancel session
              </button>
            </>
          ) : null}
        </div>
      }
      leftHeader={undefined}
      onLogOut={onLogOut}
      right={
        <div className="stack-panel">
          <div className="detail-card detail-card--compact">
            <span className="panel-caption">Group</span>
            <strong>{meeting.groupName}</strong>
            <Link className="mini-link" to={`/groups/${meeting.groupId}`}>
              Open group
            </Link>
          </div>
          {meeting.venueId ? (
            <div className="detail-card detail-card--compact">
              <span className="panel-caption">Venue</span>
              <strong>{meeting.locationName}</strong>
              <Link className="mini-link" to={`/venues/${meeting.venueId}`}>
                Open venue
              </Link>
            </div>
          ) : null}
        </div>
      }
      rightHeader={undefined}
      theme={theme}
      title={`Session: ${meeting.title}`}
      toggleTheme={toggleTheme}
      viewer={viewer}
    />
  );
}
