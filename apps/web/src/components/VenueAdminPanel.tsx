import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Plus, Search } from "lucide-react";
import type { AdminVenueSummary } from "../../../../packages/shared/src";
import { getAdminVenues } from "../lib/api";
import { VenueAdminForm } from "./VenueAdminForm";

export function VenueAdminPanel() {
  const venuesQuery = useQuery({ queryFn: getAdminVenues, queryKey: ["admin-venues"] });
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const venues = venuesQuery.data?.venues ?? [];
  const selectedVenue = venues.find((venue) => venue.id === selectedId) ?? null;
  const filteredVenues = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? venues.filter((venue) => `${venue.name} ${venue.address} ${venue.id}`.toLowerCase().includes(query))
      : venues;
  }, [search, venues]);

  function selectVenue(venue: AdminVenueSummary) {
    setCreating(false);
    setSelectedId(venue.id);
  }

  return (
    <div className="stack-panel venue-admin">
      <div className="venue-admin__heading">
        <div className="stack-sm">
          <p className="panel-caption">Venue manager</p>
          <h3 className="detail-title">Curate published venues</h3>
          <p className="muted-copy">Changes are published immediately. Archived venues remain available here but disappear from the public app.</p>
        </div>
        <button className="button-primary" onClick={() => { setCreating(true); setSelectedId(null); }} type="button">
          <Plus size={14} /> New venue
        </button>
      </div>

      {venuesQuery.isLoading ? <p className="muted-copy">Loading venues...</p> : null}
      {venuesQuery.isError ? <p className="form-error">{venuesQuery.error instanceof Error ? venuesQuery.error.message : "Could not load venues."}</p> : null}

      {!venuesQuery.isLoading && !venuesQuery.isError ? (
        <div className="venue-admin__workspace">
          <aside className="venue-admin__sidebar" aria-label="Venue list">
            <label className="venue-admin__search">
              <Search size={15} />
              <span className="sr-only">Search venues</span>
              <input onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${venues.length} venues`} type="search" value={search} />
            </label>
            <div className="venue-admin__list">
              {filteredVenues.map((venue) => (
                <button
                  className={`venue-admin__venue${venue.id === selectedId ? " is-selected" : ""}`}
                  key={venue.id}
                  onClick={() => selectVenue(venue)}
                  type="button"
                >
                  <span className="venue-admin__venue-name"><MapPin size={14} /> {venue.name}</span>
                  <span className="venue-admin__venue-meta">{venue.pricing} · {venue.environment.replace("_", " + ")}</span>
                  {venue.isArchived ? <span className="mini-chip mini-chip--muted">Archived</span> : null}
                </button>
              ))}
              {filteredVenues.length === 0 ? <p className="empty-state">No venues match this search.</p> : null}
            </div>
          </aside>

          <main className="venue-admin__editor">
            {creating || selectedVenue ? (
              <VenueAdminForm
                key={creating ? "new" : selectedVenue!.id}
                onSaved={(savedVenue) => { setCreating(false); setSelectedId(savedVenue.id); }}
                venue={creating ? null : selectedVenue}
              />
            ) : (
              <div className="empty-state venue-admin__empty">
                <MapPin size={22} />
                <strong>Select a venue to review it</strong>
                <span>Or create a new curated venue.</span>
              </div>
            )}
          </main>
        </div>
      ) : null}
    </div>
  );
}
