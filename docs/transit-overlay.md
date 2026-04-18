# Berlin Transit Overlay

Melon Meet can render a Berlin U-Bahn/S-Bahn overlay beneath venue, group, and session markers.

## Data Sources

- VBB GTFS static data: `https://unternehmen.vbb.de/fileadmin/user_upload/VBB/Dokumente/API-Datensaetze/gtfs-mastscharf/GTFS.zip`
- VBB line colors: `https://unternehmen.vbb.de/fileadmin/user_upload/VBB/Dokumente/API-Datensaetze/linienfarben.zip`
- Attribution: `VBB Verkehrsverbund Berlin-Brandenburg GmbH`

The generated overlay is written to:

```bash
apps/web/public/transit/berlin-transit.geojson
```

## Generate Locally

```bash
npm run transit:generate
```

Then run the app locally:

```bash
npm run dev
```

The map fetches `/transit/berlin-transit.geojson` when available. If the file is missing, the map falls back to the normal base map without the colored line overlay.

## Notes

- The generator filters VBB GTFS routes to line refs beginning with `U` or `S`.
- Line geometries are derived from GTFS `shapes.txt`.
- Station dots and labels are derived from GTFS stops used by selected U-Bahn/S-Bahn trips.
- The first implementation uses GeoJSON because Berlin-only U/S data is small enough for local testing. If the overlay grows too large for production, switch the generated output to vector tiles or PMTiles.
