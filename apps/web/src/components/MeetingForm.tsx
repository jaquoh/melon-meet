import { useEffect, useState } from "react";
import type { GroupSummary, MeetingSummary } from "../../../../packages/shared/src";
import { fromDateTimeLocalInput, toDateTimeLocalInput } from "../lib/format";

interface MeetingFormProps {
  groups: GroupSummary[];
  initialLocation?: {
    latitude: number;
    locationAddress: string;
    locationName: string;
    longitude: number;
    venueId?: string | null;
  } | null;
  initialMeeting?: MeetingSummary | null;
  onSubmit: (payload: Record<string, unknown>) => Promise<unknown>;
}

function canCreateForGroup(group: GroupSummary) {
  if (!group.viewerRole) return false;
  if (group.visibility === "private") return true;
  return group.viewerRole === "owner" || group.viewerRole === "admin";
}

export function MeetingForm({
  groups,
  initialLocation,
  initialMeeting,
  onSubmit,
}: MeetingFormProps) {
  const creatableGroups = groups.filter(canCreateForGroup);
  const [groupId, setGroupId] = useState(initialMeeting?.groupId ?? creatableGroups[0]?.id ?? "");
  const [title, setTitle] = useState(initialMeeting?.title ?? "");
  const [description, setDescription] = useState(initialMeeting?.description ?? "");
  const [activityLabel, setActivityLabel] = useState(initialMeeting?.activityLabel ?? "Beach volleyball");
  const [startsAt, setStartsAt] = useState(
    initialMeeting ? toDateTimeLocalInput(initialMeeting.startsAt) : "",
  );
  const [endsAt, setEndsAt] = useState(
    initialMeeting ? toDateTimeLocalInput(initialMeeting.endsAt) : "",
  );
  const [locationName, setLocationName] = useState(
    initialMeeting?.locationName ?? initialLocation?.locationName ?? "",
  );
  const [locationAddress, setLocationAddress] = useState(
    initialMeeting?.locationAddress ?? initialLocation?.locationAddress ?? "",
  );
  const [latitude, setLatitude] = useState(
    initialMeeting?.latitude ?? initialLocation?.latitude ?? 52.52,
  );
  const [longitude, setLongitude] = useState(
    initialMeeting?.longitude ?? initialLocation?.longitude ?? 13.405,
  );
  const [pricing, setPricing] = useState<"free" | "paid">(initialMeeting?.pricing ?? "free");
  const [capacity, setCapacity] = useState(initialMeeting?.capacity ?? 8);
  const [recurrenceType, setRecurrenceType] = useState<"once" | "weekly">(
    initialMeeting?.seriesId ? "weekly" : "once",
  );
  const [untilDate, setUntilDate] = useState("");
  const [applyToSeries, setApplyToSeries] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!initialLocation) return;
    setLocationName(initialLocation.locationName);
    setLocationAddress(initialLocation.locationAddress);
    setLatitude(initialLocation.latitude);
    setLongitude(initialLocation.longitude);
  }, [initialLocation]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!groupId) return;
    setSubmitting(true);
    try {
      const payload = initialMeeting
        ? {
            activityLabel,
            applyToSeries,
            capacity: Number(capacity),
            description,
            endsAt: fromDateTimeLocalInput(endsAt),
            latitude: Number(latitude),
            locationAddress,
            locationName,
            longitude: Number(longitude),
            pricing,
            startsAt: fromDateTimeLocalInput(startsAt),
            title,
            venueId: initialLocation?.venueId ?? initialMeeting.venueId,
          }
        : {
            activityLabel,
            capacity: Number(capacity),
            description,
            endsAt: fromDateTimeLocalInput(endsAt),
            groupId,
            latitude: Number(latitude),
            locationAddress,
            locationName,
            longitude: Number(longitude),
            pricing,
            recurrence:
              recurrenceType === "weekly"
                ? { type: "weekly", timezone: "Europe/Berlin", untilDate: untilDate || null }
                : { type: "once" },
            startsAt: fromDateTimeLocalInput(startsAt),
            title,
            venueId: initialLocation?.venueId ?? null,
          };
      await onSubmit(payload);
    } finally {
      setSubmitting(false);
    }
  }

  if (!initialMeeting && creatableGroups.length === 0) {
    return (
      <p className="empty-state">
        Join a private group or become an owner/admin in a public group before creating meetings.
      </p>
    );
  }

  return (
    <form className="form-grid form-grid--two" onSubmit={handleSubmit}>
      {!initialMeeting ? (
        <label className="field-stack field-full">
          <span className="field-label">Group</span>
          <select className="field-select" onChange={(event) => setGroupId(event.target.value)} value={groupId}>
            {creatableGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name} ({group.visibility})
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="field-stack field-full">
        <span className="field-label">Title</span>
        <input className="field-input" onChange={(event) => setTitle(event.target.value)} required value={title} />
      </label>

      <label className="field-stack field-full">
        <span className="field-label">Description</span>
        <textarea className="field-area" onChange={(event) => setDescription(event.target.value)} value={description} />
      </label>

      <label className="field-stack">
        <span className="field-label">Starts</span>
        <input className="field-input" onChange={(event) => setStartsAt(event.target.value)} required type="datetime-local" value={startsAt} />
      </label>

      <label className="field-stack">
        <span className="field-label">Ends</span>
        <input className="field-input" onChange={(event) => setEndsAt(event.target.value)} required type="datetime-local" value={endsAt} />
      </label>

      <label className="field-stack">
        <span className="field-label">Activity</span>
        <input className="field-input" onChange={(event) => setActivityLabel(event.target.value)} value={activityLabel} />
      </label>

      <label className="field-stack">
        <span className="field-label">Capacity</span>
        <input className="field-input" min={2} onChange={(event) => setCapacity(Number(event.target.value))} required type="number" value={capacity} />
      </label>

      <label className="field-stack">
        <span className="field-label">Pricing</span>
        <select className="field-select" onChange={(event) => setPricing(event.target.value as "free" | "paid")} value={pricing}>
          <option value="free">Free</option>
          <option value="paid">Paid</option>
        </select>
      </label>

      {!initialMeeting ? (
        <label className="field-stack">
          <span className="field-label">Repeat</span>
          <select className="field-select" onChange={(event) => setRecurrenceType(event.target.value as "once" | "weekly")} value={recurrenceType}>
            <option value="once">One-time</option>
            <option value="weekly">Weekly</option>
          </select>
        </label>
      ) : null}

      {!initialMeeting && recurrenceType === "weekly" ? (
        <label className="field-stack">
          <span className="field-label">Repeat until</span>
          <input className="field-input" onChange={(event) => setUntilDate(event.target.value)} type="date" value={untilDate} />
        </label>
      ) : null}

      {initialMeeting?.seriesId ? (
        <label className="field-check field-full">
          <input checked={applyToSeries} onChange={(event) => setApplyToSeries(event.target.checked)} type="checkbox" />
          Apply these changes to future weekly occurrences
        </label>
      ) : null}

      <label className="field-stack field-full">
        <span className="field-label">Location name</span>
        <input className="field-input" onChange={(event) => setLocationName(event.target.value)} required value={locationName} />
      </label>

      <label className="field-stack field-full">
        <span className="field-label">Address</span>
        <input className="field-input" onChange={(event) => setLocationAddress(event.target.value)} required value={locationAddress} />
      </label>

      <label className="field-stack">
        <span className="field-label">Latitude</span>
        <input className="field-input" onChange={(event) => setLatitude(Number(event.target.value))} required step="0.000001" type="number" value={latitude} />
      </label>

      <label className="field-stack">
        <span className="field-label">Longitude</span>
        <input className="field-input" onChange={(event) => setLongitude(Number(event.target.value))} required step="0.000001" type="number" value={longitude} />
      </label>

      <div className="form-actions field-full">
        <button className="button-primary" disabled={submitting}>
          {submitting ? "Saving" : initialMeeting ? "Save meeting" : "Create meeting"}
        </button>
      </div>
    </form>
  );
}
