# Design-Spec: Foto-Galerie & Dashboard-Kachel

**Datum:** 2026-05-05  
**Status:** Genehmigt

---

## Überblick

Neue Foto-Funktionalität für die zweiaufachse-App bestehend aus:
1. Einem PHP-Script, das den Foto-Upload-Ordner ausliest und EXIF-Daten als JSON zurückgibt
2. Einem `photoService.js`, der die Daten pollt und in den App-State integriert
3. Einer neuen Dashboard-Kachel auf der Startseite (unterhalb "Wo sind sie gerade?")
4. Einer vollständig neu aufgebauten Galerie-Seite (`#/gallery`) mit drei Views

Die bestehende mock-basierte `galleryPage.js` und der `galleryItems`-Mock werden vollständig entfernt.

---

## 1. Daten-Schicht

### PHP-Script `bilderupload/list.php`

- Scannt `bilderupload/iPhone/Recents/` nach JPG- und HEIC-Dateien
- Liest per `exif_read_data()` folgende Felder: GPS-Koordinaten (Lat/Lon), `DateTimeOriginal`
- Gibt ein JSON-Array zurück, sortiert nach Datum absteigend
- Fotos ohne GPS-Daten werden eingeschlossen (lat/lon = null)
- Response-Format:

```json
[
  {
    "url": "/bilderupload/iPhone/Recents/IMG_001.jpg",
    "filename": "IMG_001.jpg",
    "date": "2026-05-03T14:22:00",
    "lat": 48.123,
    "lon": 9.456
  }
]
```

- CORS-Header werden gesetzt, damit der Browser das Script aufrufen kann
- Bei leerem Ordner: leeres Array `[]`
- Script-Pfad: `bilderupload/list.php` (liegt auf dem Webserver, nicht im lokalen Repo — nur der Client-seitige Fetch-Aufruf ist im JS)

### `src/services/photoService.js`

- Pollt `https://zweiaufachse.thefinks.de/bilderupload/list.php` alle 10 Minuten
- Erstes Laden beim App-Start sofort
- Gibt Zustand `{ photos, photoLoading, photoError }` zurück
- Benachrichtigt die App per Callback (gleiche Architektur wie `locationHistoryService`)
- `photos` ist das aufbereitete Array, direkt für alle Views verwendbar

### App-State-Integration (`src/app/app.js`)

- `photoData` (Array), `photoLoading` (bool), `photoError` (string|null) werden dem State hinzugefügt
- Werden an `renderDashboardPage` und `renderGalleryPage` weitergegeben

---

## 2. Dashboard-Kachel

### Komponente `createPhotoDashboardTile(photos)` in `src/components/cards.js`

- CSS-Klasse: `dashboard-focus-card dashboard-focus-card--photos`
- Wird in `dashboardPage.js` im `dashboard-main-grid` direkt nach `createRouteDashboardMapTile` eingefügt
- Eyebrow: "Fotos", Titel: "Letzte Bilder von unterwegs"
- Gesamte Kachel ist ein `<a href="#/gallery">`

**Layout (2-spaltig):**
```
┌─────────────────────────────────┐
│ Fotos · Letzte Bilder           │
├────────────┬────────────────────┤
│            │  [Foto 2][Foto 3]  │
│  [Foto 1]  ├────────────────────┤
│  (Highlight│  [Foto 4][Foto 5]  │
│   des Tags)├────────────────────┤
│            │  47 Fotos gesamt   │
└────────────┴────────────────────┘
```

- Links: neuestes Foto des letzten Reisetags (größer, als Highlight)
- Rechts: 4 weitere aktuelle Fotos im 2×2-Raster
- Rechts unten: Gesamtanzahl Fotos als Metainfo
- Fallback (keine Fotos): Placeholder-Text "Noch keine Fotos hochgeladen"
- Fallback (loading): "Fotos werden geladen…"

---

## 3. Galerie-Seite (`#/gallery`)

### `src/pages/galleryPage.js` — Vollständige Neuerstellung

Die Seite hat drei Views, umschaltbar über eine Tab-Leiste:

#### Tab 1 — Grid (Standard-View)

- Fotos nach Reisetag gruppiert, neueste zuerst
- Pro Tag: Datumsheader (z.B. "03. Mai 2026") + Foto-Raster
- 3 Spalten Desktop, 2 Spalten mobil
- Klick auf ein Foto → Lightbox (nativer `<dialog>` oder eigenes Overlay):
  - Vollbild-Darstellung
  - Datum der Aufnahme
  - Ortsname via Reverse Geocoding (bestehenden `geocodeService.js` wiederverwenden)
  - Schließen per Klick/Escape

#### Tab 2 — Karte

- Leaflet-Karte (gleiche Bibliothek wie `liveMapService.js`)
- GPX-Route als Polylinie im Hintergrund
- Jedes Foto mit GPS-Koordinaten als Marker: kleines Vorschaubild-Icon (32×32px Thumbnail)
- Fotos ohne GPS werden unterhalb der Karte in einer kompakten Liste gezeigt
- Klick auf Marker → Popup mit größerem Foto + Datum + Ortsname
- Karte zoomt initial auf den Bereich mit den meisten Fotos

#### Tab 3 — Route-Timeline *(kreatives Extra)*

- Bestehende SVG-Routenkarte aus `createRouteSvgMarkup` in `routeCards.js` wird wiederverwendet
- Fotos werden als kleine Kreise (10px) auf der Route eingezeichnet, an der GPS-gematchten Position (nächster Routenpunkt)
- Hover/Klick auf einen Kreis → Tooltip/Overlay mit Foto-Vorschau + Datum
- So ist auf einen Blick sichtbar, wo auf der 4.500-km-Strecke jedes Foto entstand
- Fotos ohne GPS werden nicht auf der Route angezeigt (werden im Grid-Tab sichtbar)

---

## 4. Betroffene Dateien

| Datei | Aktion |
|---|---|
| `bilderupload/list.php` | Neu (auf Webserver, PHP) |
| `src/services/photoService.js` | Neu |
| `src/pages/galleryPage.js` | Vollständige Neuerstellung |
| `src/components/cards.js` | Ergänzung `createPhotoDashboardTile` |
| `src/pages/dashboardPage.js` | Kachel einbinden |
| `src/app/app.js` | photoService starten, State erweitern |
| `src/styles/app.css` | Neue CSS-Klassen für Kachel, Grid, Tabs, Lightbox, Route-Dots |
| `src/data/mockData.js` | `galleryItems`-Mock entfernen |
| `src/config/modules.js` | Gallery-Modul auf neue Render-Funktion verweist (bereits so) |

---

## 5. Nicht im Scope

- Upload-Funktion aus der App heraus (Fotos kommen per iPhone direkt auf den Server)
- Benutzerverwaltung / Sichtbarkeitssteuerung der Fotos
- Video-Unterstützung
- Kommentarfunktion
- Server-seitiges Thumbnail-Caching (die `<img>`-Tags laden die Originalbilder; Resize via CSS)
