# Go-Live Execution Plan — Timo & Tino on Tour

Stand: 2026-07-13. Reihenfolge = Ausführungsreihenfolge. Jeder Block ist einzeln deploybar.

## Phase 1 — Performance-Fundament (größter Hebel)

### 1.1 Route-Preprocessing (5,9 MB GPX → ~350 KB JSON)
- Neues Script `tools/build-route-data.mjs`:
  - GPX einlesen, Douglas-Peucker-Simplifizierung mit ~10 m Toleranz (geometrie-erhaltend, keine sichtbare Abweichung).
  - Kumulative Distanzen, Bounds, Höhenprofil-Samples, Gesamtkennzahlen vorberechnen.
  - Output: `src/route/route-data.json` (committet, wird deployt).
- `gpxRouteService.js` lädt das JSON statt GPX zu parsen (Fallback auf GPX-Parsing bleibt für lokale Entwicklung optional).
- `routePositionService.js`: Matching von nächstem *Punkt* auf nächstes *Segment* (Punkt-auf-Linie-Projektion) umstellen, damit `routeStatusLabel` („sauber auf der Route") bei größerem Punktabstand korrekt bleibt. Zusätzlich Monotonie-Guard: bevorzugt Kandidaten nahe dem letzten Match-Index (Schutz bei Fähre/Umleitung/Routen-Selbstannäherung).
- **Routenänderung unterwegs:** neue GPX ablegen → Script laufen lassen → push → Auto-Deploy. Original-GPX bleibt im Repo.

### 1.2 POI-Daten verschlanken (1,2 MB → ~100 KB)
- Preprocessing im selben Script: nur die von der UI genutzten Felder behalten (id, name, country, category, score, coordinates, routeKm, distanceFromRouteKm, routeFit, shortDescription, whyItMattersForApp, curationLevel, verificationStatus).
- `raw`, `contentIdeas`, `scoreBreakdown`, `codeAgentGeneratorPrompt` etc. entfernen.
- `poiService.js` auf das kompakte File umstellen.

### 1.3 Foto-Thumbnails + EXIF-Cache (Server)
- `list.php`: Thumbnails per GD erzeugen (einmalig, gecacht in `thumbs/`): ~400 px für Grid/Kachel, ~1600 px für Lightbox. Response um `thumbUrl` + `lightboxUrl` erweitern.
- EXIF-Scan-Ergebnis in JSON-Datei cachen (Invalidierung über Datei-mtime/Anzahl), statt bei jedem Poll jedes Foto neu zu lesen.
- Frontend: Grid/Kachel nutzen `thumbUrl`, Lightbox `lightboxUrl`.

### 1.4 Leaflet selbst hosten
- `leaflet.js`/`leaflet.css` nach `src/vendor/` kopieren, in `index.html` mit `defer` laden. Entfernt unpkg als Single Point of Failure und Render-Blocking im `<head>`.

## Phase 2 — Korrektheit & Robustheit

### 2.1 Globalen Error-Handler entschärfen
- `index.html`: `error`/`unhandledrejection`-Handler nach erfolgreichem App-Start deregistrieren. Ein unbehandelter Fehler im Betrieb darf die laufende App nicht mehr durch die Fehlerseite ersetzen.

### 2.2 Lightbox-Bug im Galerie-Tab „Route"
- `createPhotoRouteSvg`: `data-lightbox-index` korrekt setzen (Original-Index in `state.photoData` durchreichen statt Index im GPS-gefilterten Array). Aktuell öffnet jeder Punkt Foto 0.

### 2.3 Kaputten Fallback-Link fixen
- `dashboardPage.js` Placeholder-Tile: `href="#route"` → `href="#/route"`.

### 2.4 Tages-Kilometer korrekt aus Traccar (ersetzt localStorage-Ansatz)
- Neuer Service `traccarHistoryService.js`: `GET /api/positions?deviceId=&from=&to=` für **Kalendertag heute** und **gestern** (lokale Zeit der Fahrer als Referenz), einmal pro Session + Refresh alle ~15 min.
- Tages-km = Distanz entlang der Route zwischen erster und letzter Position des Kalendertags (Projektion auf Route wie bisher), Fallback: aufsummierte Haversine-Distanz der Positionen.
- `locationHistoryService.js` (localStorage) wird dafür stillgelegt/entfernt — jeder Betrachter sieht dieselben echten Zahlen, egal wann er die App öffnet.

### 2.5 Frische-Anzeige + Zustands-Icons (Vertrauenssignal Nr. 1)
- Neuer Status-Chip „aktualisiert vor X Min/Std" aus `snapshot.timestamp`.
- Zustandslogik (abgeleitet aus Fix-Alter, Bewegung, lokaler Uhrzeit am Standort):
  - **fahrend** (in Bewegung) — bestehender Puls-Chip.
  - **Pause** (tagsüber, > ~10 min keine Bewegung) — Rast-Icon (z. B. ☕/🧘), Puls-Animation aus.
  - **schläft** (nachts am Standort, keine Bewegung) — Mond/Zelt-Icon.
  - **Signal veraltet** (Fix älter als ~2 h trotz Tageszeit) — dezenter Hinweis statt Live-Puls.
- Endlos-„Signal empfangen···" bei identischen Timestamps beseitigen (Folge der Zustandslogik).

## Phase 3 — Go-Live-Checkliste (Konfiguration, kein Code)

- [ ] `src/config/locationProvider.local.js` mit Traccar-Daten **manuell per FTP** hochladen (ist gitignored; Deploy löscht sie nicht, da `dangerous-clean-slate: false`).
- [ ] In Traccar einen **Read-only-Benutzer** anlegen und dessen Token verwenden (Token ist im Client lesbar).
- [ ] Traccar-CORS für die App-Domain prüfen.
- [ ] `tripMeta.startDate` in `src/data/mockData.js` setzen (sonst ewig „Tag 1").
- [ ] `.htaccess` auf Webspace: `Cache-Control: no-cache` für `*.js`/`*.css` (Hotfixes kommen sofort bei allen an; Files sind nach Phase 1 klein).
- [ ] Traccar Client auf dem iPhone: Sendeintervall 30–60 s, High Accuracy; Webapp-Polling 30 s.
- [ ] Nach Umstellung: einmal komplett auf dem echten iPhone + einem alten Android testen.

## Phase 4 — UI/UX-Politur (ein Deploy als Paket)

1. **Dashboard-Hero:** Flagge + Ortsname (Geocode) + „Tag N" + heutige km + Fortschritts-% als eine große Kopfzeile; Zahlen mit Count-up (WAAPI), Fortschrittsbalken animiert beim ersten Paint.
2. **Bottom-Tab-Bar:** Start / Route / Fotos, fix unten, `env(safe-area-inset-bottom)`. Shell bekommt echtes `data-app-nav`.
3. **PWA-lite:** `manifest.json`, App-Icon, `apple-touch-icon`, `theme-color` → „Zum Home-Bildschirm hinzufügen". Kein Service Worker.
4. **View Transitions:** `document.startViewTransition` um `renderPage` (progressive enhancement).
5. **Skeleton-Shimmer** statt „…wird geladen"-Texten (Foto-Kachel, POI-Kacheln, Karte).
6. **Karten-Einstieg animieren:** Stagger-Fade der Dashboard-Cards nur beim ersten Render; alles hinter `prefers-reduced-motion` (auch bestehende Puls-Animationen nachrüsten).
7. **Lightbox:** Slide-Übergang beim Swipe, Nachbarbilder vorladen, Zähler „3/24".
8. **Grenz-Moment in der Voraus-Kachel:** nächster Grenzübergang prominent oben (🇦🇹→🇮🇹 „in 43 km"), Rest der Liste darunter.
9. **Umlaut-Pass:** sichtbare Strings vereinheitlichen („Sehenswuerdigkeit" → „Sehenswürdigkeit" etc., Anzeige-Labels, nicht Daten-Keys).
10. **Wikipedia-Fallback:** liefert de.wikipedia < 3 Treffer (Balkan!), zusätzlich en.wikipedia geosearch abfragen und mergen.

## Phase 5 — Challenger „Living Scene" (nach Go-Live, separater Track)

Animierte Radfahrer-Szene als alternative Startseite (Option 2 im A/B-Vergleich zur klassischen Kachel-Ansicht). Eigener Tech-Stack erlaubt (z. B. React + Vite + Framer Motion oder Rive), läuft parallel unter eigenem Einstieg (z. B. `/live/`), nutzt dieselben Services als Datenschicht.

Entschieden (2026-07-13):
- **Art Direction:** je ein kleines visuelles MVP in zwei Stilen bauen — (1) Flat-Travel-Poster (passend zur bestehenden Palette), (2) verspielt/comichaft (Timo & Tino als Charaktere) — dann Entscheidung am lebenden Objekt.
- **v1-Umfang:** Zustände fahrend/Pause/schlafend, Trikot = aktuelle Landesflagge, Parallax-Landschaft, Grenz-Countdown, Kilometerstein, Polaroids bei neuen Fotos, **echtes Wetter (Open-Meteo)**. v2: Straßenneigung nach echtem Gradient, „Replay des Tages".
