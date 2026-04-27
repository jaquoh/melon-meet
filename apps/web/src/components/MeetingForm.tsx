import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import type { GroupSummary, MeetingSummary } from "../../../../packages/shared/src";
import { getVenues } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { FilterCheckbox } from "./FilterCheckbox";
import { fromDateTimeLocalInput, toDateTimeLocalInput } from "../lib/format";

interface MeetingFormProps {
  formId?: string;
  groups: GroupSummary[];
  initialLocation?: {
    latitude: number;
    locationAddress: string;
    locationName: string;
    longitude: number;
    venueId?: string | null;
  } | null;
  initialMeeting?: MeetingSummary | null;
  initialSeriesDates?: Array<{ endsAt: string; startsAt: string }>;
  onSubmit: (payload: Record<string, unknown>) => Promise<unknown>;
  seriesMode?: boolean;
}

function canCreateForGroup(group: GroupSummary) {
  if (!group.viewerRole) return false;
  if (group.visibility === "private") return true;
  return group.viewerRole === "owner" || group.viewerRole === "admin";
}

export function MeetingForm({
  formId,
  groups,
  initialLocation,
  initialMeeting,
  initialSeriesDates = [],
  onSubmit,
  seriesMode = false,
}: MeetingFormProps) {
  const { formatPrice, formatVisibility, locale, t } = useI18n();
  const creatableGroups = groups.filter(canCreateForGroup);
  const venuesQuery = useQuery({
    queryFn: getVenues,
    queryKey: ["venues"],
  });
  const venues = venuesQuery.data?.venues ?? [];
  const [groupId, setGroupId] = useState(initialMeeting?.groupId ?? creatableGroups[0]?.id ?? "");
  const [shortName, setShortName] = useState(initialMeeting?.shortName ?? "");
  const [title, setTitle] = useState(initialMeeting?.title ?? "");
  const [description, setDescription] = useState(initialMeeting?.description ?? "");
  const [activityLabel, setActivityLabel] = useState(initialMeeting?.activityLabel ?? "Beach volleyball");
  const [heroImageUrl, setHeroImageUrl] = useState(initialMeeting?.heroImageUrl ?? "");
  const [selectedVenueId, setSelectedVenueId] = useState(initialMeeting?.venueId ?? initialLocation?.venueId ?? "other");
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
  const [costPerPerson, setCostPerPerson] = useState(initialMeeting?.costPerPerson?.toString() ?? "");
  const [capacity, setCapacity] = useState(initialMeeting?.capacity ?? 8);
  const [buildSeries, setBuildSeries] = useState(seriesMode);
  const [seriesDates, setSeriesDates] = useState<Array<{ endsAt: string; startsAt: string }>>(
    initialSeriesDates.map((entry) => ({
      endsAt: toDateTimeLocalInput(entry.endsAt),
      startsAt: toDateTimeLocalInput(entry.startsAt),
    })),
  );
  const [applyToSeries, setApplyToSeries] = useState(seriesMode);
  const [submitting, setSubmitting] = useState(false);
  const knownVenue = useMemo(
    () => venues.find((venue) => venue.id === selectedVenueId) ?? null,
    [selectedVenueId, venues],
  );
  const isOtherLocation = selectedVenueId === "other";
  const inheritedFieldClassName = `field-input${isOtherLocation ? "" : " field-input--inherited"}`;

  useEffect(() => {
    if (!initialLocation) return;
    if (initialLocation.venueId) {
      setSelectedVenueId(initialLocation.venueId);
    } else {
      setSelectedVenueId("other");
      setLocationName(initialLocation.locationName);
      setLocationAddress(initialLocation.locationAddress);
      setLatitude(initialLocation.latitude);
      setLongitude(initialLocation.longitude);
    }
  }, [initialLocation]);

  useEffect(() => {
    if (!knownVenue || isOtherLocation) {
      return;
    }
    setLocationName(knownVenue.name);
    setLocationAddress(knownVenue.address);
    setLatitude(knownVenue.latitude);
    setLongitude(knownVenue.longitude);
  }, [isOtherLocation, knownVenue]);

  useEffect(() => {
    if (!seriesMode) {
      return;
    }
    setBuildSeries(true);
    setApplyToSeries(true);
    setSeriesDates(
      initialSeriesDates.map((entry) => ({
        endsAt: toDateTimeLocalInput(entry.endsAt),
        startsAt: toDateTimeLocalInput(entry.startsAt),
      })),
    );
  }, [initialSeriesDates, seriesMode]);

  function addSeriesDate() {
    if (!startsAt || !endsAt) {
      return;
    }
    setSeriesDates((current) =>
      [...current.filter((entry) => entry.startsAt !== startsAt), { endsAt, startsAt }].sort(
        (left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
      ),
    );
  }

  function removeSeriesDate(target: string) {
    setSeriesDates((current) => current.filter((item) => item.startsAt !== target));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!groupId) return;
    setSubmitting(true);
    try {
      const payload = initialMeeting
        ? {
            activityLabel,
            capacity: Number(capacity),
            description,
            endsAt: fromDateTimeLocalInput(endsAt),
            heroImageUrl,
            latitude: Number(latitude),
            locationAddress,
            locationName,
            longitude: Number(longitude),
            pricing,
            costPerPerson: pricing === "paid" ? Number(costPerPerson || 0) : null,
            seriesDates: buildSeries || seriesMode
              ? seriesDates.map((entry) => ({
                  endsAt: fromDateTimeLocalInput(entry.endsAt),
                  startsAt: fromDateTimeLocalInput(entry.startsAt),
                }))
              : [],
            applyToSeries: seriesMode || applyToSeries,
            shortName,
            startsAt: fromDateTimeLocalInput(startsAt),
            title,
            venueId: isOtherLocation ? null : selectedVenueId,
          }
        : {
            activityLabel,
            capacity: Number(capacity),
            description,
            endsAt: fromDateTimeLocalInput(endsAt),
            groupId,
            heroImageUrl,
            latitude: Number(latitude),
            locationAddress,
            locationName,
            longitude: Number(longitude),
            pricing,
            costPerPerson: pricing === "paid" ? Number(costPerPerson || 0) : null,
            recurrence: { type: "once" },
            seriesDates: buildSeries
              ? seriesDates.map((entry) => ({
                  endsAt: fromDateTimeLocalInput(entry.endsAt),
                  startsAt: fromDateTimeLocalInput(entry.startsAt),
                }))
              : [],
            shortName,
            startsAt: fromDateTimeLocalInput(startsAt),
            title,
            venueId: isOtherLocation ? null : selectedVenueId,
          };
      await onSubmit(payload);
    } finally {
      setSubmitting(false);
    }
  }

  if (!initialMeeting && creatableGroups.length === 0) {
    return (
      <p className="empty-state">
        {t("forms.joinGroupRequirement")}
      </p>
    );
  }

  return (
    <form className="form-grid form-grid--two" id={formId} onSubmit={handleSubmit}>
      {!initialMeeting ? (
        <label className="field-stack field-full">
          <span className="field-label">{t("forms.group")}</span>
          <select className="field-select" onChange={(event) => setGroupId(event.target.value)} value={groupId}>
            {creatableGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name} ({formatVisibility(group.visibility)})
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="field-stack field-full">
        <span className="field-label">{t("forms.shortName")}</span>
        <input className="field-input" maxLength={24} onChange={(event) => setShortName(event.target.value)} required value={shortName} />
      </label>

      <label className="field-stack field-full">
        <span className="field-label">{t("forms.title")}</span>
        <input className="field-input" onChange={(event) => setTitle(event.target.value)} required value={title} />
      </label>

      <label className="field-stack field-full">
        <span className="field-label">{t("forms.description")}</span>
        <textarea className="field-area" onChange={(event) => setDescription(event.target.value)} value={description} />
      </label>

      <label className="field-stack field-full">
        <span className="field-label">{t("forms.heroImageUrl")}</span>
        <input className="field-input" onChange={(event) => setHeroImageUrl(event.target.value)} placeholder="https://..." type="url" value={heroImageUrl} />
      </label>

      <label className="field-stack">
        <span className="field-label">{t("forms.starts")}</span>
        <input className="field-input" onChange={(event) => setStartsAt(event.target.value)} required type="datetime-local" value={startsAt} />
      </label>

      <label className="field-stack">
        <span className="field-label">{t("forms.ends")}</span>
        <input className="field-input" onChange={(event) => setEndsAt(event.target.value)} required type="datetime-local" value={endsAt} />
      </label>

      <div className="field-full stack-sm">
        {seriesMode ? (
          <p className="muted-copy">{t("forms.editingSeriesHint")}</p>
        ) : (
          <FilterCheckbox checked={buildSeries} label={t("forms.buildSeries")} onChange={setBuildSeries} />
        )}
        <div className="form-actions">
          <button className="button-secondary button-inline" disabled={!(buildSeries || seriesMode)} onClick={addSeriesDate} type="button">
            <Plus size={14} strokeWidth={2} />
            <span>{t("forms.addSession")}</span>
          </button>
        </div>
      </div>

      {buildSeries || seriesMode ? (
        <div className="field-full stack-sm">
          <span className="panel-caption">{t("forms.sessionDates")}</span>
          {seriesDates.length === 0 ? (
            <p className="muted-copy">{t("forms.useAddSessionHint")}</p>
          ) : (
            <div className="series-slot-list">
              {seriesDates.map((entry) => (
                <div className="series-slot-item" key={entry.startsAt}>
                  <div>
                    <strong>{new Date(entry.startsAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}</strong>
                    <p className="muted-copy">
                      {Math.round((new Date(entry.endsAt).getTime() - new Date(entry.startsAt).getTime()) / 60000)} min
                    </p>
                  </div>
                  <button className="button-secondary button-inline" onClick={() => removeSeriesDate(entry.startsAt)} type="button">
                    <Trash2 size={14} strokeWidth={2} />
                    <span>{t("forms.remove")}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <label className="field-stack">
        <span className="field-label">{t("forms.activity")}</span>
        <input className="field-input" onChange={(event) => setActivityLabel(event.target.value)} value={activityLabel} />
      </label>

      <label className="field-stack">
        <span className="field-label">{t("forms.capacity")}</span>
        <input className="field-input" min={2} onChange={(event) => setCapacity(Number(event.target.value))} required type="number" value={capacity} />
      </label>

      <div className="field-stack">
        <span className="field-label">{t("forms.pricing")}</span>
        <div className="meeting-pricing-row">
          <div className="workspace-segmented workspace-segmented--fit">
            <button className={pricing === "free" ? "is-active" : ""} onClick={() => setPricing("free")} type="button">
              {t("common.free")}
            </button>
            <button className={pricing === "paid" ? "is-active" : ""} onClick={() => setPricing("paid")} type="button">
              {t("common.paid")}
            </button>
          </div>
          <div className="meeting-pricing-row__aside">
            {pricing === "paid" ? (
              <label className="field-stack">
                <span className="field-label">{t("forms.amountPerPerson")}</span>
                <input
                  className="field-input"
                  min={0}
                  onChange={(event) => setCostPerPerson(event.target.value)}
                  placeholder="10"
                  step="0.5"
                  type="number"
                  value={costPerPerson}
                />
              </label>
            ) : (
              <div className="meeting-pricing-row__placeholder" aria-hidden="true" />
            )}
          </div>
        </div>
      </div>

      {initialMeeting?.seriesId && !seriesMode ? (
        <div className="field-full">
          <FilterCheckbox checked={applyToSeries} label={t("forms.applyToSeries")} onChange={setApplyToSeries} />
        </div>
      ) : null}

      <label className="field-stack field-full">
        <span className="field-label">{t("forms.location")}</span>
        <select className="field-select" onChange={(event) => setSelectedVenueId(event.target.value)} value={selectedVenueId}>
          {venues.map((venue) => (
            <option key={venue.id} value={venue.id}>
              {venue.name}
            </option>
          ))}
          <option value="other">{t("forms.otherLocation")}</option>
        </select>
      </label>

      <label className="field-stack field-full">
        <span className="field-label">{t("forms.locationName")}</span>
        <input className={inheritedFieldClassName} disabled={!isOtherLocation} onChange={(event) => setLocationName(event.target.value)} required value={locationName} />
      </label>

      <label className="field-stack field-full">
        <span className="field-label">{t("forms.address")}</span>
        <input className={inheritedFieldClassName} disabled={!isOtherLocation} onChange={(event) => setLocationAddress(event.target.value)} required value={locationAddress} />
      </label>

      <label className="field-stack">
        <span className="field-label">{t("forms.latitude")}</span>
        <input className={inheritedFieldClassName} disabled={!isOtherLocation} onChange={(event) => setLatitude(Number(event.target.value))} required step="0.000001" type="number" value={latitude} />
      </label>

      <label className="field-stack">
        <span className="field-label">{t("forms.longitude")}</span>
        <input className={inheritedFieldClassName} disabled={!isOtherLocation} onChange={(event) => setLongitude(Number(event.target.value))} required step="0.000001" type="number" value={longitude} />
      </label>

    </form>
  );
}
