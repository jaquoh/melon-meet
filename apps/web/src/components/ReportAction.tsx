import { Flag, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReportReason, ReportTargetType } from "../../../../packages/shared/src";
import { createReport } from "../lib/api";

const REPORT_REASON_OPTIONS: Array<{ label: string; value: ReportReason }> = [
  { label: "Spam", value: "spam" },
  { label: "Harassment or abusive behavior", value: "harassment" },
  { label: "Hate, threats, or violent content", value: "hate_or_threats" },
  { label: "Sexual or explicit content", value: "sexual_content" },
  { label: "Misleading, scam, or phishing behavior", value: "scam_or_phishing" },
  { label: "Unsafe event or real-world safety concern", value: "safety_concern" },
  { label: "Impersonation", value: "impersonation" },
  { label: "Underage or participation concern", value: "underage_concern" },
  { label: "Other", value: "other" },
];

export function ReportAction({
  buttonLabel = "Report",
  targetId,
  targetLabel,
  targetType,
}: {
  buttonLabel?: string;
  targetId: string;
  targetLabel: string;
  targetType: ReportTargetType;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("spam");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setOpen(false);
    setReason("spam");
    setNote("");
    setError(null);
    setSubmitted(false);
    setSubmitting(false);
  }, [targetId, targetType]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createReport({
        note,
        reason,
        targetId,
        targetType,
      });
      setSubmitted(true);
      setNote("");
      setReason("spam");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not submit report.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="report-action stack-xs">
      <button
        className="button-secondary button-inline"
        onClick={() => {
          setOpen(true);
          setError(null);
          setSubmitted(false);
        }}
        type="button"
      >
        <Flag size={14} strokeWidth={2} />
        <span>{buttonLabel}</span>
      </button>
      {open ? (
        <div className="report-action__modal" role="dialog" aria-modal="true" aria-label={`Report ${targetLabel}`}>
          <div className="report-action__backdrop" onClick={() => setOpen(false)} />
          <div className="report-action__dialog stack-sm">
            {submitted ? (
              <div className="stack-sm report-action__content">
                <div className="report-action__header">
                  <div className="stack-xs">
                    <p className="panel-caption">Report sent</p>
                    <h3 className="detail-title">Thanks for the report.</h3>
                  </div>
                  <button
                    aria-label="Close report dialog"
                    className="button-secondary workspace-panel-close-square report-action__close"
                    onClick={() => setOpen(false)}
                    type="button"
                  >
                    <X size={16} strokeWidth={2} />
                  </button>
                </div>
                <p className="muted-copy">We received it and will review it as soon as possible.</p>
                <div className="form-actions">
                  <button
                    className="button-primary"
                    onClick={() => {
                      setOpen(false);
                      setSubmitted(false);
                    }}
                    type="button"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form className="report-action__content stack-sm" onSubmit={handleSubmit}>
                <div className="report-action__header">
                  <div className="stack-xs">
                    <p className="panel-caption">Report {targetLabel}</p>
                    <h3 className="detail-title">Tell us what happened</h3>
                  </div>
                  <button
                    aria-label="Close report dialog"
                    className="button-secondary workspace-panel-close-square report-action__close"
                    onClick={() => setOpen(false)}
                    type="button"
                  >
                    <X size={16} strokeWidth={2} />
                  </button>
                </div>
                <select className="field-select" onChange={(event) => setReason(event.target.value as ReportReason)} value={reason}>
                  {REPORT_REASON_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <textarea
                  className="field-area"
                  maxLength={500}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Optional note"
                  rows={4}
                  value={note}
                />
                {error ? <p className="form-error">{error}</p> : null}
                <div className="form-actions">
                  <button className="button-primary" disabled={submitting} type="submit">
                    {submitting ? "Sending..." : "Submit report"}
                  </button>
                  <button
                    className="button-secondary"
                    onClick={() => {
                      setOpen(false);
                      setError(null);
                    }}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
