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
      <p className="rounded-3xl border border-dashed border-stone-200 bg-stone-50 px-4 py-5 text-sm text-stone-500">
        Join a private group or become an owner/admin in a public group before creating meetings.
      </p>
    );
  }

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
      {!initialMeeting ? (
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium text-stone-600">Group</span>
          <select className="block w-full rounded-2xl border-stone-200 bg-stone-50 px-4 py-3 text-sm" onChange={(event) => setGroupId(event.target.value)} value={groupId}>
            {creatableGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name} ({group.visibility})
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="space-y-2 md:col-span-2">
        <span className="text-sm font-medium text-stone-600">Title</span>
        <input className="block w-full rounded-2xl border-stone-200 bg-stone-50 px-4 py-3 text-sm" onChange={(event) => setTitle(event.target.value)} required value={title} />
      </label>

      <label className="space-y-2 md:col-span-2">
        <span className="text-sm font-medium text-stone-600">Description</span>
        <textarea className="block min-h-24 w-full rounded-2xl border-stone-200 bg-stone-50 px-4 py-3 text-sm" onChange={(event) => setDescription(event.target.value)} value={description} />
      </label>

      <label className="space-y-2">
        <span className="text-sm font-medium text-stone-600">Starts</span>
        <input className="block w-full rounded-2xl border-stone-200 bg-stone-50 px-4 py-3 text-sm" onChange={(event) => setStartsAt(event.target.value)} required type="datetime-local" value={startsAt} />
      </label>

      <label className="space-y-2">
        <span className="text-sm font-medium text-stone-600">Ends</span>
        <input className="block w-full rounded-2xl border-stone-200 bg-stone-50 px-4 py-3 text-sm" onChange={(event) => setEndsAt(event.target.value)} required type="datetime-local" value={endsAt} />
      </label>

      <label className="space-y-2">
        <span className="text-sm font-medium text-stone-600">Activity</span>
        <input className="block w-full rounded-2xl border-stone-200 bg-stone-50 px-4 py-3 text-sm" onChange={(event) => setActivityLabel(event.target.value)} value={activityLabel} />
      </label>

      <label className="space-y-2">
        <span className="text-sm font-medium text-stone-600">Capacity</span>
        <input className="block w-full rounded-2xl border-stone-200 bg-stone-50 px-4 py-3 text-sm" min={2} onChange={(event) => setCapacity(Number(event.target.value))} required type="number" value={capacity} />
      </label>

      <label className="space-y-2">
        <span className="text-sm font-medium text-stone-600">Pricing</span>
        <select className="block w-full rounded-2xl border-stone-200 bg-stone-50 px-4 py-3 text-sm" onChange={(event) => setPricing(event.target.value as "free" | "paid")} value={pricing}>
          <option value="free">Free</option>
          <option value="paid">Paid</option>
        </select>
      </label>

      {!initialMeeting ? (
        <label className="space-y-2">
          <span className="text-sm font-medium text-stone-600">Repeat</span>
          <select className="block w-full rounded-2xl border-stone-200 bg-stone-50 px-4 py-3 text-sm" onChange={(event) => setRecurrenceType(event.target.value as "once" | "weekly")} value={recurrenceType}>
            <option value="once">One-time</option>
            <option value="weekly">Weekly</option>
          </select>
        </label>
      ) : null}

      {!initialMeeting && recurrenceType === "weekly" ? (
        <label className="space-y-2">
          <span className="text-sm font-medium text-stone-600">Repeat until</span>
          <input className="block w-full rounded-2xl border-stone-200 bg-stone-50 px-4 py-3 text-sm" onChange={(event) => setUntilDate(event.target.value)} type="date" value={untilDate} />
        </label>
      ) : null}

      {initialMeeting?.seriesId ? (
        <label className="md:col-span-2 flex items-center gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
          <input checked={applyToSeries} onChange={(event) => setApplyToSeries(event.target.checked)} type="checkbox" />
          Apply these changes to future weekly occurrences
        </label>
      ) : null}

      <label className="space-y-2 md:col-span-2">
        <span className="text-sm font-medium text-stone-600">Location name</span>
        <input className="block w-full rounded-2xl border-stone-200 bg-stone-50 px-4 py-3 text-sm" onChange={(event) => setLocationName(event.target.value)} required value={locationName} />
      </label>

      <label className="space-y-2 md:col-span-2">
        <span className="text-sm font-medium text-stone-600">Address</span>
        <input className="block w-full rounded-2xl border-stone-200 bg-stone-50 px-4 py-3 text-sm" onChange={(event) => setLocationAddress(event.target.value)} required value={locationAddress} />
      </label>

      <label className="space-y-2">
        <span className="text-sm font-medium text-stone-600">Latitude</span>
        <input className="block w-full rounded-2xl border-stone-200 bg-stone-50 px-4 py-3 text-sm" onChange={(event) => setLatitude(Number(event.target.value))} required step="0.000001" type="number" value={latitude} />
      </label>

      <label className="space-y-2">
        <span className="text-sm font-medium text-stone-600">Longitude</span>
        <input className="block w-full rounded-2xl border-stone-200 bg-stone-50 px-4 py-3 text-sm" onChange={(event) => setLongitude(Number(event.target.value))} required step="0.000001" type="number" value={longitude} />
      </label>

      <div className="md:col-span-2 flex justify-end">
        <button className="rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting}>
          {submitting ? "Saving..." : initialMeeting ? "Save meeting" : "Create meeting"}
        </button>
      </div>
    </form>
  );
}
