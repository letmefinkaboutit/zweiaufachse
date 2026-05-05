# Foto-Galerie Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Echtzeit-Foto-Galerie mit Dashboard-Kachel, Grid-View, Leaflet-Karten-View und SVG-Route-Timeline, gespeist durch PHP-EXIF-Backend.

**Architecture:** Ein PHP-Script auf dem Webserver liest EXIF-Daten (GPS, Datum) aus dem Foto-Ordner und gibt JSON zurück. `photoService.js` pollt dieses Script alle 10 Minuten und speist den App-State. Die Gallery-Seite wird vollständig neu geschrieben mit drei Tabs (Grid, Karte, Route). Die Kachel auf dem Dashboard zeigt die letzten 5 Fotos als Preview.

**Tech Stack:** Vanilla JS ES-Module, PHP `exif_read_data()`, Leaflet.js (bereits via CDN geladen), Hash-Router (bestehend), kein Build-Tool.

> **Hinweis:** Dieses Projekt hat kein automatisiertes Test-Framework. Verifikationsschritte erfolgen manuell im Browser. Jede Aufgabe enthält explizite Browser-Verifikation.

---

## Dateiübersicht

| Datei | Aktion |
|---|---|
| `bilderupload/list.php` | Neu erstellen |
| `.gitignore` | Ergänzen |
| `src/services/photoService.js` | Neu erstellen (Task 2) |
| `src/services/photoMapService.js` | Neu erstellen (Task 3) — muss vor app.js existieren |
| `src/app/app.js` | Modifizieren (Task 4) — erst nach Task 2 + 3 |
| `src/components/cards.js` | Ergänzen (`createPhotoDashboardTile`), entfernen (`createGalleryCard`) |
| `src/pages/dashboardPage.js` | Ergänzen (Kachel einbinden) |
| `src/pages/galleryPage.js` | Vollständig neu schreiben |
| `src/components/routeCards.js` | Ergänzen (`createPhotoRouteSvg`) |
| `src/styles/app.css` | Ergänzen (neue CSS-Klassen) |
| `src/data/mockData.js` | `galleryItems`-Export entfernen |

---

## Task 1: PHP-Script + .gitignore

**Files:**
- Create: `bilderupload/list.php`
- Modify: `.gitignore`

- [ ] **Step 1: .gitignore erweitern** — Bilder nie in git, PHP-Script schon

Ersetze den Inhalt von `.gitignore` durch:
```
.DS_Store
src/config/locationProvider.local.js
bilderupload/iPhone/
```

- [ ] **Step 2: PHP-Script erstellen**

Erstelle `bilderupload/list.php` mit folgendem Inhalt:

```php
<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$dir = __DIR__ . '/iPhone/Recents/';
$results = [];

if (!is_dir($dir)) {
    echo json_encode([]);
    exit;
}

foreach (new DirectoryIterator($dir) as $file) {
    if ($file->isDot() || $file->isDir()) {
        continue;
    }

    $ext = strtolower($file->getExtension());
    if (!in_array($ext, ['jpg', 'jpeg'])) {
        continue;
    }

    $path  = $file->getPathname();
    $url   = '/bilderupload/iPhone/Recents/' . rawurlencode($file->getFilename());
    $date  = null;
    $lat   = null;
    $lon   = null;

    $exif = @exif_read_data($path);

    if ($exif) {
        if (!empty($exif['DateTimeOriginal'])) {
            $parts    = explode(' ', $exif['DateTimeOriginal'], 2);
            $datePart = str_replace(':', '-', $parts[0]);
            $timePart = $parts[1] ?? '00:00:00';
            $date     = $datePart . 'T' . $timePart;
        }

        if (!empty($exif['GPSLatitude']) && !empty($exif['GPSLongitude'])) {
            $lat = gpsToDecimal($exif['GPSLatitude'], $exif['GPSLatitudeRef'] ?? 'N');
            $lon = gpsToDecimal($exif['GPSLongitude'], $exif['GPSLongitudeRef'] ?? 'E');
        }
    }

    $results[] = [
        'url'      => $url,
        'filename' => $file->getFilename(),
        'date'     => $date,
        'lat'      => $lat,
        'lon'      => $lon,
    ];
}

usort($results, function ($a, $b) {
    if ($a['date'] === null && $b['date'] === null) {
        return 0;
    }
    if ($a['date'] === null) {
        return 1;
    }
    if ($b['date'] === null) {
        return -1;
    }
    return strcmp($b['date'], $a['date']);
});

echo json_encode($results, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

function gpsToDecimal(array $gps, string $ref): float
{
    $parts = array_map(function ($frac) {
        $split = explode('/', $frac);
        return count($split) === 2 ? (float) $split[0] / max(1, (float) $split[1]) : (float) $frac;
    }, $gps);

    $decimal = ($parts[0] ?? 0) + ($parts[1] ?? 0) / 60 + ($parts[2] ?? 0) / 3600;

    if ($ref === 'S' || $ref === 'W') {
        $decimal *= -1;
    }

    return round($decimal, 6);
}
```

> **Hinweis HEIC:** `exif_read_data()` unterstützt kein HEIC nativ. iPhone-Einstellung: Einstellungen → Kamera → Formate → "Maximale Kompatibilität" aktivieren, damit JPEGs hochgeladen werden.

- [ ] **Step 3: Commit**

```bash
git add bilderupload/list.php .gitignore
git commit -m "feat: PHP-Script liest Foto-EXIF und gibt JSON zurück"
```

- [ ] **Step 4: Auf Server deployen und verifizieren**

Das PHP-Script per FTP/CI nach `bilderupload/list.php` auf den Server hochladen, dann im Browser öffnen:
```
https://zweiaufachse.thefinks.de/bilderupload/list.php
```
Erwartetes Ergebnis: JSON-Array (leer `[]` wenn noch keine Fotos, oder Array mit Objekten wenn Fotos vorhanden).

---

## Task 2: Photo Service

**Files:**
- Create: `src/services/photoService.js`

- [ ] **Step 1: Service erstellen**

Erstelle `src/services/photoService.js`:

```javascript
const PHOTO_API_URL = 'https://zweiaufachse.thefinks.de/bilderupload/list.php';
const POLL_INTERVAL_MS = 10 * 60 * 1000;

export function startPhotoService({ onUpdate, onError }) {
  async function poll() {
    try {
      const res = await fetch(PHOTO_API_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const photos = await res.json();
      onUpdate(photos);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Fotos konnten nicht geladen werden.');
    }
  }

  poll();
  const id = setInterval(poll, POLL_INTERVAL_MS);
  return { stop: () => clearInterval(id) };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/photoService.js
git commit -m "feat: photoService pollt list.php alle 10 Minuten"
```

---

## Task 3: Photo Map Service

**Files:**
- Create: `src/services/photoMapService.js`

> **Muss vor Task 4 (app.js) erstellt werden**, da app.js diesen Service importiert.

- [ ] **Step 1: photoMapService.js erstellen**

Erstelle `src/services/photoMapService.js`:

```javascript
const PLACEHOLDER_ID = 'gallery-map-placeholder';
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

const mapEl = document.createElement('div');
mapEl.className = 'gallery-map-el';

let map = null;
let photoLayer = null;
let routeLayer = null;

function initPhotoMap() {
  if (map || !window.L) return;

  map = window.L.map(mapEl, {
    zoomControl: true,
    attributionControl: false,
    preferCanvas: true,
  });

  window.L.tileLayer(TILE_URL, { subdomains: 'abcd', maxZoom: 19 }).addTo(map);

  window.L.control
    .attribution({ prefix: false })
    .addAttribution(
      '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/">CARTO</a>',
    )
    .addTo(map);

  routeLayer = window.L.layerGroup().addTo(map);
  photoLayer = window.L.layerGroup().addTo(map);
}

export function updatePhotoMap(photos, routeData) {
  if (!map) return;

  routeLayer.clearLayers();
  if (routeData?.sampledRoute?.length) {
    const coords = routeData.sampledRoute.map((p) => [p.lat, p.lon]);
    window.L.polyline(coords, { color: '#eb8f34', weight: 2.5, opacity: 0.6 }).addTo(routeLayer);
  }

  photoLayer.clearLayers();
  const geoPhotos = photos.filter((p) => p.lat != null && p.lon != null);

  for (const photo of geoPhotos) {
    const icon = window.L.divIcon({
      className: '',
      html: `<div class="photo-map-marker"><img src="${photo.url}" alt="" /></div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    const marker = window.L.marker([photo.lat, photo.lon], { icon }).addTo(photoLayer);

    const dateLabel = photo.date
      ? new Date(photo.date).toLocaleString('de-DE', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Datum unbekannt';

    marker.bindPopup(`
      <div class="map-popup">
        <img src="${photo.url}" class="map-popup__img" alt="${photo.filename}" />
        <p class="map-popup__desc">${dateLabel}</p>
      </div>
    `);
  }

  if (geoPhotos.length > 0) {
    const bounds = window.L.latLngBounds(geoPhotos.map((p) => [p.lat, p.lon]));
    map.fitBounds(bounds, { padding: [40, 40] });
  } else if (routeData?.bounds) {
    const { minLat, maxLat, minLon, maxLon } = routeData.bounds;
    map.fitBounds(
      [
        [minLat, minLon],
        [maxLat, maxLon],
      ],
      { padding: [20, 20] },
    );
  }
}

export function mountPhotoMapObserver(getState) {
  const observer = new MutationObserver(() => {
    const placeholder = document.getElementById(PLACEHOLDER_ID);
    if (placeholder) {
      initPhotoMap();
      placeholder.parentNode?.replaceChild(mapEl, placeholder);
      requestAnimationFrame(() => {
        map?.invalidateSize();
        const { photoData, routeData } = getState();
        updatePhotoMap(photoData ?? [], routeData);
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/photoMapService.js
git commit -m "feat: photoMapService mit Leaflet für Gallery-Karten-Tab"
```

---

## Task 4: App-State + Click-Delegation

**Files:**
- Modify: `src/app/app.js`

- [ ] **Step 1: Import und State-Felder hinzufügen**

Füge am Anfang von `src/app/app.js` nach dem letzten Import-Statement ein:
```javascript
import { startPhotoService } from "../services/photoService.js";
import { mountPhotoMapObserver } from "../services/photoMapService.js";
```

Ergänze im `state`-Objekt (nach `overpassUnavailable: false`):
```javascript
    photoData: [],
    photoLoading: true,
    photoError: null,
    galleryTab: 'grid',
```

- [ ] **Step 2: photoService starten**

Füge nach `mountMapObserver();` ein:
```javascript
  mountPhotoMapObserver(() => state);

  const photoServiceInstance = startPhotoService({
    onUpdate(photos) {
      state.photoData = photos;
      state.photoLoading = false;
      state.photoError = null;
      router.refresh();
    },
    onError(message) {
      state.photoLoading = false;
      state.photoError = message;
      router.refresh();
    },
  });
```

- [ ] **Step 3: Click-Delegation für Tabs und Lightbox**

Füge nach dem bestehenden `root.addEventListener("change", ...)` Block ein:

```javascript
  root.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('[data-gallery-tab]');
    if (tabBtn) {
      state.galleryTab = tabBtn.dataset.galleryTab;
      router.refresh();
      return;
    }

    const photoTrigger = e.target.closest('[data-lightbox-src]');
    if (photoTrigger) {
      const dialog = document.getElementById('photo-lightbox');
      if (dialog) {
        const img = dialog.querySelector('.lightbox__img');
        const caption = dialog.querySelector('.lightbox__caption');
        if (img) img.src = photoTrigger.dataset.lightboxSrc;
        if (caption) caption.textContent = photoTrigger.dataset.lightboxCaption ?? '';
        dialog.showModal();
      }
      return;
    }

    if (e.target.closest('[data-lightbox-close]') || e.target.id === 'photo-lightbox') {
      document.getElementById('photo-lightbox')?.close();
    }
  });
```

- [ ] **Step 4: photoService beim Unload stoppen**

Ersetze das bestehende `beforeunload`-Listener:
```javascript
  window.addEventListener("beforeunload", () => {
    locationProvider?.stop();
    photoServiceInstance.stop();
  });
```

- [ ] **Step 5: Commit**

```bash
git add src/app/app.js
git commit -m "feat: photoService und Click-Delegation in app.js integriert"
```

---

## Task 4: Dashboard-Kachel CSS + Komponente

**Files:**
- Modify: `src/styles/app.css`
- Modify: `src/components/cards.js`
- Modify: `src/pages/dashboardPage.js`

- [ ] **Step 1: CSS für Photo-Tile hinzufügen**

Füge am Ende von `src/styles/app.css` ein:

```css
/* ── Photo Dashboard Tile ──────────────────────────────── */
.dashboard-focus-card--photos {
  gap: 16px;
}

.photo-tile-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  height: 180px;
}

.photo-tile-highlight {
  border-radius: var(--radius-sm);
  overflow: hidden;
  height: 100%;
}

.photo-tile-highlight img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.photo-tile-secondary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr auto;
  gap: 6px;
}

.photo-tile-small {
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.photo-tile-small img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.photo-tile-count {
  grid-column: 1 / -1;
  font-size: 0.78rem;
  color: var(--muted);
  margin: 0;
  align-self: center;
}

@media (max-width: 540px) {
  .photo-tile-grid {
    height: 160px;
  }
}
```

- [ ] **Step 2: `createPhotoDashboardTile` in cards.js hinzufügen**

Füge am Ende von `src/components/cards.js` vor der letzten Zeile (vor `export`) ein:

```javascript
export function createPhotoDashboardTile(photos, photoLoading) {
  const header = `
    <div class="dashboard-focus-card__header">
      <div>
        <p class="section-intro__eyebrow">Fotos</p>
        <h3>Letzte Bilder von unterwegs</h3>
      </div>
    </div>
  `;

  if (photoLoading) {
    return `
      <a class="dashboard-focus-card dashboard-focus-card--photos" href="#/gallery">
        ${header}
        <p class="muted-text">Fotos werden geladen…</p>
      </a>
    `;
  }

  if (!photos?.length) {
    return `
      <a class="dashboard-focus-card dashboard-focus-card--photos" href="#/gallery">
        ${header}
        <p class="muted-text">Noch keine Fotos hochgeladen.</p>
      </a>
    `;
  }

  const highlight = photos[0];
  const rest = photos.slice(1, 5);
  const totalLabel = `${photos.length} Foto${photos.length !== 1 ? 's' : ''}`;

  const restItems = rest
    .map(
      (photo) => `
        <div class="photo-tile-small">
          <img src="${photo.url}" alt="${photo.filename}" loading="lazy" />
        </div>
      `,
    )
    .join('');

  return `
    <a class="dashboard-focus-card dashboard-focus-card--photos" href="#/gallery">
      ${header}
      <div class="photo-tile-grid">
        <div class="photo-tile-highlight">
          <img src="${highlight.url}" alt="${highlight.filename}" loading="lazy" />
        </div>
        <div class="photo-tile-secondary">
          ${restItems}
          <p class="photo-tile-count">${totalLabel} gesamt</p>
        </div>
      </div>
    </a>
  `;
}
```

- [ ] **Step 3: Kachel in dashboardPage.js einbinden**

Ergänze den Import am Anfang von `src/pages/dashboardPage.js`:
```javascript
import { createInfoCard, createModuleTile, createPhotoDashboardTile } from "../components/cards.js";
```

Füge im `renderDashboardPage`-Body vor `const currentTile` ein:
```javascript
  const photoTile = createPhotoDashboardTile(state.photoData, state.photoLoading);
```

Füge `${photoTile}` im Template nach `${routeMapTile}` ein:
```javascript
      <div class="dashboard-main-grid">
        ${createJourneyTimelineCard(state.routeData, state.locationData, state.countrySegments, state.dailyStats)}
        ${routeMapTile}
        ${photoTile}
        ${currentTile}
        ${forwardTile}
      </div>
```

- [ ] **Step 4: Im Browser verifizieren**

Browser öffnen, Dashboard aufrufen. Erwartetes Ergebnis:
- Neue Kachel "Letzte Bilder von unterwegs" erscheint unterhalb der Live-Karte
- Bei keinen Fotos: Placeholder-Text sichtbar
- Klick auf Kachel → navigiert zu `#/gallery`

- [ ] **Step 5: Commit**

```bash
git add src/styles/app.css src/components/cards.js src/pages/dashboardPage.js
git commit -m "feat: Photo-Dashboard-Kachel mit Preview der letzten Bilder"
```

---

## Task 5: Gallery-Seite — Grid-Tab + Lightbox

**Files:**
- Modify: `src/pages/galleryPage.js`

- [ ] **Step 1: galleryPage.js vollständig neu schreiben**

Ersetze den gesamten Inhalt von `src/pages/galleryPage.js`:

```javascript
import { createPhotoRouteSvg } from "../components/routeCards.js";

function renderGridTab(photos, photoLoading, photoError) {
  if (photoLoading) {
    return `<p class="muted-text">Fotos werden geladen…</p>`;
  }
  if (photoError) {
    return `<p class="muted-text">Fehler: ${photoError}</p>`;
  }
  if (!photos.length) {
    return `<p class="muted-text">Noch keine Fotos vorhanden.</p>`;
  }

  const byDay = new Map();
  for (const photo of photos) {
    const key = photo.date ? photo.date.slice(0, 10) : 'unknown';
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(photo);
  }

  const groups = [...byDay.entries()]
    .map(([key, dayPhotos]) => {
      const label =
        key === 'unknown'
          ? 'Datum unbekannt'
          : new Date(key).toLocaleDateString('de-DE', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            });

      const imgs = dayPhotos
        .map(
          (photo) => `
            <button
              class="gallery-photo-btn"
              data-lightbox-src="${photo.url}"
              data-lightbox-caption="${photo.date ? new Date(photo.date).toLocaleString('de-DE') : ''}"
              aria-label="${photo.filename}"
            >
              <img src="${photo.url}" alt="${photo.filename}" loading="lazy" />
            </button>
          `,
        )
        .join('');

      return `
        <div class="gallery-day-group">
          <h4 class="gallery-day-label">${label}</h4>
          <div class="gallery-photo-grid">${imgs}</div>
        </div>
      `;
    })
    .join('');

  return `<div class="gallery-grid-view">${groups}</div>`;
}

function renderMapTab(photos) {
  const noGps = photos.filter((p) => p.lat == null || p.lon == null);

  const noGpsList = noGps.length
    ? `
      <div class="gallery-no-gps">
        <p class="muted-text">Fotos ohne GPS (${noGps.length}):</p>
        <div class="gallery-photo-grid">
          ${noGps
            .map(
              (p) => `
            <button class="gallery-photo-btn" data-lightbox-src="${p.url}" data-lightbox-caption="${p.filename}">
              <img src="${p.url}" alt="${p.filename}" loading="lazy" />
            </button>
          `,
            )
            .join('')}
        </div>
      </div>
    `
    : '';

  return `
    <div class="gallery-map-view">
      <div id="gallery-map-placeholder" class="gallery-map-el"></div>
      ${noGpsList}
    </div>
  `;
}

function renderRouteTab(photos, routeData, locationData) {
  if (!routeData) {
    return `<p class="muted-text">Route wird noch geladen…</p>`;
  }
  const withGps = photos.filter((p) => p.lat != null && p.lon != null);
  if (!withGps.length) {
    return `<p class="muted-text">Noch keine Fotos mit GPS-Daten vorhanden.</p>`;
  }
  return createPhotoRouteSvg(routeData, locationData, photos);
}

export function renderGalleryPage(state = {}) {
  const {
    photoData: photos = [],
    photoLoading,
    photoError,
    galleryTab = 'grid',
    routeData,
    locationData,
  } = state;

  const tabs = [
    { id: 'grid', label: 'Fotos' },
    { id: 'map', label: 'Karte' },
    { id: 'route', label: 'Route' },
  ];

  const tabBar = `
    <div class="gallery-tabs">
      ${tabs
        .map(
          (t) => `
        <button
          class="gallery-tab${galleryTab === t.id ? ' is-active' : ''}"
          data-gallery-tab="${t.id}"
        >${t.label}</button>
      `,
        )
        .join('')}
    </div>
  `;

  const content =
    galleryTab === 'map'
      ? renderMapTab(photos)
      : galleryTab === 'route'
        ? renderRouteTab(photos, routeData, locationData)
        : renderGridTab(photos, photoLoading, photoError);

  return `
    <div class="page-stack">
      <div class="section-intro">
        <p class="section-intro__eyebrow">Galerie</p>
        <h2>Fotos von unterwegs</h2>
      </div>
      ${tabBar}
      ${content}
      <dialog id="photo-lightbox" class="photo-lightbox">
        <button class="photo-lightbox__close" data-lightbox-close aria-label="Schliessen">&#x2715;</button>
        <img class="lightbox__img" src="" alt="" />
        <p class="lightbox__caption"></p>
      </dialog>
    </div>
  `;
}
```

- [ ] **Step 2: CSS für Gallery Grid + Lightbox hinzufügen**

Füge am Ende von `src/styles/app.css` ein:

```css
/* ── Gallery Page ──────────────────────────────────────── */
.gallery-tabs {
  display: flex;
  gap: 8px;
}

.gallery-tab {
  padding: 8px 18px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--muted);
  font-size: 0.9rem;
  cursor: pointer;
  font-family: var(--font-body);
  transition: background 0.15s, color 0.15s;
}

.gallery-tab.is-active {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
}

.gallery-grid-view {
  display: grid;
  gap: 28px;
}

.gallery-day-group {
  display: grid;
  gap: 10px;
}

.gallery-day-label {
  font-size: 0.85rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 0;
}

.gallery-photo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.gallery-photo-btn {
  all: unset;
  cursor: pointer;
  border-radius: var(--radius-sm);
  overflow: hidden;
  aspect-ratio: 1;
  display: block;
}

.gallery-photo-btn img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: opacity 0.15s;
}

.gallery-photo-btn:hover img {
  opacity: 0.85;
}

/* Lightbox */
.photo-lightbox {
  border: none;
  border-radius: var(--radius-lg);
  padding: 0;
  max-width: min(90vw, 880px);
  max-height: 90vh;
  background: #1a1a1a;
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.55);
  overflow: hidden;
}

.photo-lightbox::backdrop {
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
}

.lightbox__img {
  display: block;
  max-width: 100%;
  max-height: calc(90vh - 60px);
  object-fit: contain;
  margin: 0 auto;
}

.lightbox__caption {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.85rem;
  padding: 10px 18px;
  text-align: center;
  margin: 0;
}

.photo-lightbox__close {
  position: absolute;
  top: 12px;
  right: 14px;
  background: rgba(255, 255, 255, 0.15);
  border: none;
  color: #fff;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.gallery-no-gps {
  margin-top: 20px;
  display: grid;
  gap: 10px;
}

@media (max-width: 540px) {
  .gallery-photo-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

- [ ] **Step 3: Im Browser verifizieren**

Browser öffnen, `#/gallery` aufrufen. Erwartetes Ergebnis:
- Tab-Leiste mit "Fotos", "Karte", "Route" sichtbar
- "Fotos"-Tab aktiv, zeigt Fotos gruppiert nach Tag (oder Placeholder bei keinen Fotos)
- Klick auf ein Foto → Lightbox öffnet sich mit Vollbild und Datum
- Klick auf ✕ oder außerhalb → Lightbox schließt sich
- "Karte"-Tab zeigt Platzhalter-Div (Map-Service noch nicht implementiert)
- "Route"-Tab zeigt Placeholder-Text

- [ ] **Step 4: Commit**

```bash
git add src/pages/galleryPage.js src/styles/app.css
git commit -m "feat: Gallery-Seite neu mit Grid-Tab, Tabs und Lightbox"
```

---

## Task 6: Gallery CSS Map-View + Route-Timeline

**Files:**
- Modify: `src/styles/app.css`

- [ ] **Step 1: CSS für Map-View hinzufügen**

Füge am Ende von `src/styles/app.css` ein:

```css
/* ── Gallery Map View ──────────────────────────────────── */
.gallery-map-view {
  display: grid;
  gap: 16px;
}

.gallery-map-el {
  width: 100%;
  height: 420px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: #e8e4da;
}

.photo-map-marker {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.photo-map-marker img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* ── Gallery Route Timeline ────────────────────────────── */
.gallery-route-view {
  display: grid;
  gap: 10px;
}

.route-map-svg__photo-dot {
  fill: var(--accent);
  stroke: #fff;
  stroke-width: 2;
  transition: r 0.1s;
}

.route-map-svg__photo-dot:hover {
  r: 11;
}

@media (max-width: 540px) {
  .gallery-map-el {
    height: 300px;
  }
}
```

- [ ] **Step 2: Im Browser verifizieren**

Browser öffnen, `#/gallery` → Karte-Tab → Karte sichtbar. Route-Tab → SVG sichtbar. Kein Layout-Bruch.

- [ ] **Step 3: Commit**

```bash
git add src/styles/app.css
git commit -m "feat: CSS für Gallery Karten- und Route-Tab"
```

---

## Task 7: Route-Timeline Tab

**Files:**
- Modify: `src/components/routeCards.js`

- [ ] **Step 1: `createPhotoRouteSvg` zu routeCards.js hinzufügen**

Füge am Ende von `src/components/routeCards.js` hinzu (nach der letzten Export-Funktion):

```javascript
export function createPhotoRouteSvg(routeData, locationData, photos) {
  const width = 760;
  const height = 320;
  const padding = 28;
  const projection = createProjection(routeData, width, height, padding);
  const activeProgress = getActiveProgress(routeData, locationData);
  const currentPoint = activeProgress.currentPoint;
  const routePolyline = createProjectedPolyline(routeData.sampledRoute, projection);
  const clipId = 'routeMapClip-photos';

  let currentMarker = '';
  if (currentPoint) {
    const cur = projectCoordinate(currentPoint, projection);
    currentMarker = `<circle cx="${cur.x.toFixed(1)}" cy="${cur.y.toFixed(1)}" r="11" class="route-map-svg__current"></circle>`;
  }

  const photoDots = photos
    .filter((p) => p.lat != null && p.lon != null)
    .map((photo, index) => {
      let nearestPoint = routeData.sampledRoute[0];
      let minDist = Infinity;
      for (const pt of routeData.sampledRoute) {
        const d = (pt.lat - photo.lat) ** 2 + (pt.lon - photo.lon) ** 2;
        if (d < minDist) {
          minDist = d;
          nearestPoint = pt;
        }
      }
      const { x, y } = projectCoordinate(nearestPoint, projection);
      const caption = photo.date ? new Date(photo.date).toLocaleDateString('de-DE') : '';
      return `
        <circle
          cx="${x.toFixed(1)}"
          cy="${y.toFixed(1)}"
          r="8"
          class="route-map-svg__photo-dot"
          data-lightbox-src="${photo.url}"
          data-lightbox-caption="${caption}"
          data-photo-index="${index}"
          style="cursor:pointer"
        >
          <title>${photo.filename}${caption ? ' · ' + caption : ''}</title>
        </circle>
      `;
    })
    .join('');

  return `
    <div class="gallery-route-view">
      <p class="muted-text" style="margin-bottom:8px">Klick auf einen Punkt zeigt das Foto</p>
      <svg viewBox="0 0 ${width} ${height}" class="route-map-svg" role="img" aria-label="Routenverlauf mit Fotos">
        <defs>
          <clipPath id="${clipId}">
            <rect x="0" y="0" width="${width}" height="${height}" rx="28"></rect>
          </clipPath>
        </defs>
        <rect x="0" y="0" width="${width}" height="${height}" rx="28" class="route-map-svg__bg"></rect>
        <g clip-path="url(#${clipId})">
          ${createBasemapImages(projection)}
          <rect x="0" y="0" width="${width}" height="${height}" rx="28" class="route-map-svg__veil"></rect>
          <polyline points="${routePolyline}" class="route-map-svg__line"></polyline>
          ${currentMarker}
          ${photoDots}
        </g>
      </svg>
    </div>
  `;
}
```

- [ ] **Step 2: CSS für Route-Timeline + Photo-Dots hinzufügen**

Füge am Ende von `src/styles/app.css` ein:

```css
/* ── Gallery Route Timeline ────────────────────────────── */
.gallery-route-view {
  display: grid;
  gap: 10px;
}

.route-map-svg__photo-dot {
  fill: var(--accent);
  stroke: #fff;
  stroke-width: 2;
  transition: r 0.1s;
}

.route-map-svg__photo-dot:hover {
  r: 11;
}
```

- [ ] **Step 3: Im Browser verifizieren**

Browser öffnen, `#/gallery` aufrufen, "Route"-Tab anklicken. Erwartetes Ergebnis:
- SVG-Routenkarte erscheint mit GPX-Route
- Fotos mit GPS erscheinen als orange Kreise auf der Route
- Hover vergrößert den Kreis
- Klick auf einen Kreis → Lightbox öffnet sich mit dem Foto
- Fotos ohne GPS sind nicht sichtbar (im Grid-Tab vorhanden)

- [ ] **Step 4: Commit**

```bash
git add src/components/routeCards.js src/styles/app.css
git commit -m "feat: Route-Timeline zeigt Fotos als Punkte auf SVG-Routenkarte"
```

---

## Task 8: Cleanup

**Files:**
- Modify: `src/data/mockData.js`
- Modify: `src/components/cards.js`

- [ ] **Step 1: `galleryItems` aus mockData.js entfernen**

Lösche in `src/data/mockData.js` den gesamten `galleryItems`-Export (ab Zeile 99 bis zum Ende der Array-Definition).

- [ ] **Step 2: `createGalleryCard` aus cards.js entfernen**

Lösche in `src/components/cards.js` die `createGalleryCard`-Funktion und ihren Export. Prüfe vorher mit:
```bash
grep -rn "createGalleryCard" src/
```
Erwartetes Ergebnis: nur noch in `cards.js` selbst — kein weiterer Verweis.

- [ ] **Step 3: Im Browser verifizieren**

Browser öffnen, alle Seiten durchklicken. Kein JavaScript-Fehler in der Konsole.

- [ ] **Step 4: Commit**

```bash
git add src/data/mockData.js src/components/cards.js
git commit -m "chore: Mock-Galerie-Daten und createGalleryCard entfernt"
```

---

## Spec-Abgleich

| Spec-Anforderung | Task |
|---|---|
| PHP liest EXIF, gibt JSON zurück | Task 1 |
| Polling alle 10 Minuten | Task 2 |
| `photoData` im App-State | Task 3 |
| Dashboard-Kachel mit letzten 5 Fotos | Task 4 |
| Kachel navigiert zu `#/gallery` | Task 4 |
| Galerie-Seite mit Grid-Tab | Task 5 |
| Lightbox beim Klick | Task 5 |
| Fotos nach Tag gruppiert | Task 5 |
| Karten-Tab mit Leaflet | Task 6 |
| Fotos ohne GPS unterhalb der Karte | Task 6 |
| Route-Timeline-Tab | Task 7 |
| Mock-Daten entfernen | Task 8 |
