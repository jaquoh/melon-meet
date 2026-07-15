import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Archive, RotateCcw, Save } from "lucide-react";
import { ZodError } from "zod";
import {
  venueCreateSchema,
  venueUpdateSchema,
  type AdminVenueSummary,
  type VenueUpdateInput,
} from "../../../../packages/shared/src";
import { createAdminVenue, setAdminVenueArchived, updateAdminVenue } from "../lib/api";
import { queryClient } from "../lib/query-client";

const emptyVenue: VenueUpdateInput = {
  accessType: "public",
  address: "",
  amenities: [],
  bookingUrl: null,
  courtCountTotal: null,
  description: "",
  duplicateNotes: null,
  environment: "outdoor",
  facts: { areaNotes: [], equipment: [], parkInspectorScore: null, playerLevel: null, surface: null },
  googleMapsUrl: null,
  heroImageUrl: null,
  imageGallery: [],
  indoorCourtCount: 0,
  latitude: 52.52,
  longitude: 13.405,
  name: "",
  openingHoursText: null,
  outdoorCourtCount: 0,
  pricing: "free",
  researchedAt: null,
  seasonalityText: null,
  sourceUrl: null,
  sourceUrls: [],
  websiteUrl: null,
};

function text(data: FormData, name: string) {
  return String(data.get(name) ?? "").trim();
}

function optionalText(data: FormData, name: string) {
  return text(data, name) || null;
}

function lines(data: FormData, name: string) {
  return text(data, name).split("\n").map((entry) => entry.trim()).filter(Boolean);
}

function nullableNumber(data: FormData, name: string) {
  const value = text(data, name);
  return value === "" ? null : Number(value);
}

function venuePayload(data: FormData) {
  const researchedDate = text(data, "researchedAt");
  return venueUpdateSchema.parse({
    accessType: text(data, "accessType"),
    address: text(data, "address"),
    amenities: lines(data, "amenities"),
    bookingUrl: optionalText(data, "bookingUrl"),
    courtCountTotal: nullableNumber(data, "courtCountTotal"),
    description: text(data, "description"),
    duplicateNotes: optionalText(data, "duplicateNotes"),
    environment: text(data, "environment"),
    facts: {
      areaNotes: lines(data, "areaNotes"),
      equipment: lines(data, "equipment"),
      parkInspectorScore: nullableNumber(data, "parkInspectorScore"),
      playerLevel: optionalText(data, "playerLevel"),
      surface: optionalText(data, "surface"),
    },
    googleMapsUrl: optionalText(data, "googleMapsUrl"),
    heroImageUrl: optionalText(data, "heroImageUrl"),
    imageGallery: JSON.parse(text(data, "imageGallery") || "[]"),
    indoorCourtCount: Number(text(data, "indoorCourtCount")),
    latitude: Number(text(data, "latitude")),
    longitude: Number(text(data, "longitude")),
    name: text(data, "name"),
    openingHoursText: optionalText(data, "openingHoursText"),
    outdoorCourtCount: Number(text(data, "outdoorCourtCount")),
    pricing: text(data, "pricing"),
    researchedAt: researchedDate ? new Date(`${researchedDate}T00:00:00.000Z`).toISOString() : null,
    seasonalityText: optionalText(data, "seasonalityText"),
    sourceUrl: optionalText(data, "sourceUrl"),
    sourceUrls: lines(data, "sourceUrls"),
    websiteUrl: optionalText(data, "websiteUrl"),
  });
}

function mutationError(error: unknown) {
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    return `${issue.path.join(".") || "Venue"}: ${issue.message}`;
  }
  return error instanceof Error ? error.message : "Could not save this venue.";
}

export function VenueAdminForm({ onSaved, venue }: { onSaved: (venue: AdminVenueSummary) => void; venue: AdminVenueSummary | null }) {
  const initial = venue ?? emptyVenue;
  const [status, setStatus] = useState<string | null>(null);
  const saveMutation = useMutation({
    mutationFn: async (form: HTMLFormElement) => {
      const data = new FormData(form);
      const payload = venuePayload(data);
      return venue
        ? updateAdminVenue(venue.id, payload)
        : createAdminVenue(venueCreateSchema.parse({ ...payload, id: text(data, "id") }));
    },
    onError: (error) => setStatus(mutationError(error)),
    onSuccess: async ({ venue: savedVenue }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-venues"] }),
        queryClient.invalidateQueries({ queryKey: ["venues"] }),
        queryClient.invalidateQueries({ queryKey: ["map"] }),
      ]);
      setStatus("Venue saved and published.");
      onSaved(savedVenue);
    },
  });
  const archiveMutation = useMutation({
    mutationFn: () => setAdminVenueArchived(venue!.id, !venue!.isArchived),
    onError: (error) => setStatus(mutationError(error)),
    onSuccess: async ({ venue: savedVenue }) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-venues"] });
      setStatus(savedVenue.isArchived ? "Venue archived." : "Venue restored and published.");
      onSaved(savedVenue);
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    saveMutation.mutate(event.currentTarget);
  }

  return (
    <form className="venue-admin-form" onSubmit={submit}>
      <div className="venue-admin-form__header">
        <div className="stack-sm">
          <p className="panel-caption">{venue ? "Edit venue" : "New venue"}</p>
          <h3 className="detail-title">{venue?.name ?? "Add a curated venue"}</h3>
          <p className="muted-copy">Saving publishes the change immediately. Venue IDs stay fixed after creation.</p>
        </div>
        <div className="form-actions">
          {venue ? (
            <button
              className={venue.isArchived ? "button-secondary" : "button-danger"}
              disabled={archiveMutation.isPending}
              onClick={() => {
                if (venue.isArchived || window.confirm("Archive this venue and hide it from users?")) archiveMutation.mutate();
              }}
              type="button"
            >
              {venue.isArchived ? <RotateCcw size={14} /> : <Archive size={14} />}
              {venue.isArchived ? "Restore" : "Archive"}
            </button>
          ) : null}
          <button className="button-primary" disabled={saveMutation.isPending} type="submit">
            <Save size={14} /> {saveMutation.isPending ? "Saving" : "Save venue"}
          </button>
        </div>
      </div>

      {status ? <p className={status.includes("saved") || status.includes("restored") || status.includes("archived") ? "success-copy" : "form-error"} role="status">{status}</p> : null}

      <fieldset className="venue-admin-form__section form-grid form-grid--two">
        <legend>Basics</legend>
        {!venue ? <label className="field-stack field-full"><span className="field-label">Venue ID</span><input className="field-input" defaultValue="venue-" name="id" pattern="venue-[a-z0-9]+(?:-[a-z0-9]+)*" required /><span className="field-hint">For example: venue-beach-courts. This cannot be changed later.</span></label> : null}
        <label className="field-stack"><span className="field-label">Name</span><input className="field-input" defaultValue={initial.name} name="name" required /></label>
        <label className="field-stack"><span className="field-label">Address</span><input className="field-input" defaultValue={initial.address} name="address" required /></label>
        <label className="field-stack"><span className="field-label">Pricing</span><select className="field-input" defaultValue={initial.pricing} name="pricing"><option value="free">Free</option><option value="paid">Paid</option></select></label>
        <label className="field-stack"><span className="field-label">Access</span><select className="field-input" defaultValue={initial.accessType} name="accessType"><option value="public">Public</option><option value="bookable">Bookable</option><option value="membership">Membership</option><option value="entry_fee">Entry fee</option><option value="mixed">Mixed</option></select></label>
        <label className="field-stack"><span className="field-label">Environment</span><select className="field-input" defaultValue={initial.environment} name="environment"><option value="outdoor">Outdoor</option><option value="indoor">Indoor</option><option value="indoor_outdoor">Indoor and outdoor</option></select></label>
        <label className="field-stack"><span className="field-label">Researched date</span><input className="field-input" defaultValue={initial.researchedAt?.slice(0, 10) ?? ""} name="researchedAt" type="date" /></label>
        <label className="field-stack field-full"><span className="field-label">Description</span><textarea className="field-input" defaultValue={initial.description} name="description" required rows={5} /></label>
      </fieldset>

      <fieldset className="venue-admin-form__section form-grid form-grid--two">
        <legend>Location and courts</legend>
        <label className="field-stack"><span className="field-label">Latitude</span><input className="field-input" defaultValue={initial.latitude} name="latitude" required step="any" type="number" /></label>
        <label className="field-stack"><span className="field-label">Longitude</span><input className="field-input" defaultValue={initial.longitude} name="longitude" required step="any" type="number" /></label>
        <label className="field-stack"><span className="field-label">Total courts</span><input className="field-input" defaultValue={initial.courtCountTotal ?? ""} min="0" name="courtCountTotal" type="number" /></label>
        <label className="field-stack"><span className="field-label">Indoor courts</span><input className="field-input" defaultValue={initial.indoorCourtCount} min="0" name="indoorCourtCount" required type="number" /></label>
        <label className="field-stack"><span className="field-label">Outdoor courts</span><input className="field-input" defaultValue={initial.outdoorCourtCount} min="0" name="outdoorCourtCount" required type="number" /></label>
        <label className="field-stack"><span className="field-label">Surface</span><input className="field-input" defaultValue={initial.facts.surface ?? ""} name="surface" /></label>
        <label className="field-stack"><span className="field-label">Player level</span><input className="field-input" defaultValue={initial.facts.playerLevel ?? ""} name="playerLevel" /></label>
        <label className="field-stack"><span className="field-label">Parkinspector score</span><input className="field-input" defaultValue={initial.facts.parkInspectorScore ?? ""} max="5" min="0" name="parkInspectorScore" step="0.1" type="number" /></label>
        <label className="field-stack"><span className="field-label">Equipment</span><textarea className="field-input" defaultValue={initial.facts.equipment.join("\n")} name="equipment" rows={4} /><span className="field-hint">One item per line.</span></label>
        <label className="field-stack"><span className="field-label">Area notes</span><textarea className="field-input" defaultValue={initial.facts.areaNotes.join("\n")} name="areaNotes" rows={4} /><span className="field-hint">One item per line.</span></label>
      </fieldset>

      <fieldset className="venue-admin-form__section form-grid form-grid--two">
        <legend>Details and links</legend>
        {(["websiteUrl", "bookingUrl", "googleMapsUrl", "sourceUrl", "heroImageUrl"] as const).map((name) => <label className="field-stack" key={name}><span className="field-label">{name.replace(/([A-Z])/g, " $1")}</span><input className="field-input" defaultValue={initial[name] ?? ""} name={name} type="url" /></label>)}
        <label className="field-stack"><span className="field-label">Opening hours</span><textarea className="field-input" defaultValue={initial.openingHoursText ?? ""} name="openingHoursText" rows={3} /></label>
        <label className="field-stack"><span className="field-label">Seasonality</span><textarea className="field-input" defaultValue={initial.seasonalityText ?? ""} name="seasonalityText" rows={3} /></label>
        <label className="field-stack"><span className="field-label">Amenities</span><textarea className="field-input" defaultValue={initial.amenities.join("\n")} name="amenities" rows={5} /><span className="field-hint">One item per line.</span></label>
        <label className="field-stack"><span className="field-label">Source URLs</span><textarea className="field-input" defaultValue={initial.sourceUrls.join("\n")} name="sourceUrls" rows={5} /><span className="field-hint">One HTTPS URL per line.</span></label>
        <label className="field-stack field-full"><span className="field-label">Duplicate and research notes</span><textarea className="field-input" defaultValue={initial.duplicateNotes ?? ""} name="duplicateNotes" rows={4} /></label>
        <label className="field-stack field-full"><span className="field-label">Image gallery JSON</span><textarea className="field-input venue-admin-form__json" defaultValue={JSON.stringify(initial.imageGallery, null, 2)} name="imageGallery" rows={8} /><span className="field-hint">Advanced: keep this as a JSON array of image metadata.</span></label>
      </fieldset>
    </form>
  );
}
