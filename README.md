# Timo & Tino on Tour

Ein browsernatives MVP-Grundgeruest fuer eine mobile-first Reise-App rund um die Fahrradreise von Schorndorf nach Griechenland.

## Ziel dieses ersten Schritts

Dieses MVP setzt bewusst auf ein leichtes Fundament:

- modulare SPA-Struktur ohne Build-Zwang
- lokale Mockdaten statt echter Schnittstellen
- echte GPX-Route als zentrales Datenobjekt
- grosse, gut lesbare mobile UI
- klare Trennung von Layout, Pages, Komponenten, Konfiguration und Daten

## Projektstruktur

```text
.
|-- index.html
|-- README.md
`-- src
    |-- app
    |   |-- app.js
    |   `-- router.js
    |-- components
    |   |-- cards.js
    |   |-- poiCards.js
    |   `-- routeCards.js
    |-- config
    |   |-- locationProvider.js
    |   |-- poiConfig.js
    |   `-- modules.js
    |-- data
    |   `-- mockData.js
    |   `-- routeSource.js
    |-- layout
    |   `-- shell.js
    |-- location
    |   |-- LocationProvider.js
    |   `-- providers
    |       |-- MockProvider.js
    |       `-- TraccarProvider.js
    |-- pages
    |   |-- dashboardPage.js
    |   |-- galleryPage.js
    |   |-- homeInfoPage.js
    |   |-- profilesPage.js
    |   |-- routePage.js
    |   |-- settingsPage.js
    |   |-- statsPage.js
    |   |-- statusPage.js
    |   |-- storiesPage.js
    |   `-- updatesPage.js
    |-- styles
    |   `-- app.css
    |-- route
    |   `-- Schorndorf - Kritharia Alternative.gpx
    |-- services
    |   |-- gpxRouteService.js
    |   |-- poiService.js
    |   `-- routePositionService.js
    `-- utils
        `-- format.js
```

## Vorhandene Module

- Dashboard
- Reiseverlauf / Route
- Tagesupdates
- Statistiken
- Galerie
- Fahrerprofile
- Live-Status
- Story & Entertainment
- Info fuer Daheimgebliebene
- Einstellungen / Admin-Vorbereitung

## Wo liegen die Daten?

- Zentrale Mockdaten: [src/data/mockData.js](/Users/danielfink/Documents/zweiaufachse/src/data/mockData.js)
- GPX-Quelle und Fortschritts-Mock: [src/data/routeSource.js](/Users/danielfink/Documents/zweiaufachse/src/data/routeSource.js)
- Provider-Konfiguration: [src/config/locationProvider.js](/Users/danielfink/Documents/zweiaufachse/src/config/locationProvider.js)
- POI-Konfiguration: [src/config/poiConfig.js](/Users/danielfink/Documents/zweiaufachse/src/config/poiConfig.js)
- Zentrale Modul-Konfiguration: [src/config/modules.js](/Users/danielfink/Documents/zweiaufachse/src/config/modules.js)

Die Route wird beim Start direkt aus [src/route/Schorndorf - Kritharia Alternative.gpx](/Users/danielfink/Documents/zweiaufachse/src/route/Schorndorf%20-%20Kritharia%20Alternative.gpx) geladen und in [src/services/gpxRouteService.js](/Users/danielfink/Documents/zweiaufachse/src/services/gpxRouteService.js) in Kennzahlen, Fortschritt und Visualisierungsdaten umgewandelt.
Die aktuelle Position kommt zusaetzlich ueber die neue Provider-Schicht: [src/location/LocationProvider.js](/Users/danielfink/Documents/zweiaufachse/src/location/LocationProvider.js) schaltet zwischen [MockProvider](/Users/danielfink/Documents/zweiaufachse/src/location/providers/MockProvider.js) und [TraccarProvider](/Users/danielfink/Documents/zweiaufachse/src/location/providers/TraccarProvider.js) um. In [src/services/routePositionService.js](/Users/danielfink/Documents/zweiaufachse/src/services/routePositionService.js) wird das Live-Signal auf die GPX-Route gemappt.
Die neue POI-Datenbasis liegt in [src/poi/timo_tino_route_pois_scored_expanded_generator.json](/Users/danielfink/Documents/zweiaufachse/src/poi/timo_tino_route_pois_scored_expanded_generator.json) und wird in [src/services/poiService.js](/Users/danielfink/Documents/zweiaufachse/src/services/poiService.js) normalisiert, gefiltert und fuer die UI vorbereitet.

Die Daten sind so organisiert, dass spaeter statt Mockdaten auch API-Antworten, CMS-Inhalte oder externe Dienste eingebunden werden koennen.

## Wie wird erweitert?

1. Neue Inhalte oder Module zuerst in `src/data` und `src/config` beschreiben.
2. Danach eine neue View in `src/pages` anlegen.
3. Wiederverwendbare UI-Bausteine in `src/components` ablegen.
4. Spaeter Datenquellen wie Garmin, Strava, Bilder oder Statusmeldungen ueber Services oder API-Adapter anbinden.
5. Die aktuelle Position kann spaeter statt ueber einen Mock-Fortschrittswert ueber echte GPS- oder Tagesdaten berechnet werden.

## Location Provider

- `MockProvider` ist standardmaessig aktiv und simuliert Live-Bewegung entlang der echten GPX-Route.
- `TraccarProvider` ist vorbereitet fuer echte Positionsdaten.
- Umschalten laeuft zentral ueber `activeProvider` in `src/config/locationProvider.js`.

Zur Traccar-Vorbereitung:

- REST kann per `Bearer` oder `Basic` Auth genutzt werden.
- Fuer echte Live-Streams empfiehlt Traccar den WebSocket-Endpunkt `/api/socket`.
- Im aktuellen MVP ist Traccar erstmal als robustes REST-Polling vorbereitet.

## POI-System

- Die Datei enthaelt 461 Eintraege: 39 kuratierte Seeds und 422 auto-generierte Route-Anker.
- Standardmaessig zeigt das MVP nur hochwertige Eintraege mit `score >= 0.65`.
- `needs_enrichment`-POIs und niedrige Route-Anker bleiben erhalten, sind aber anfangs ausgeblendet.
- Die Routenansicht nutzt jetzt eine einfache POI-Liste, Filter nach Score/Kategorie/Route-Naehe/Highlight-Level und einen Marker-Layer auf der vorhandenen SVG-Route.
- Zusaetzlich werden sichtbare POIs jetzt relativ zur Live-Position gruppiert: `jetzt relevant`, `als naechstes`, `bereits passiert`.
- Marker, Journey-Bloecke und Listen werden dabei nicht mehr global nach Score, sondern im Verhaeltnis zur aktuellen Live-Position priorisiert.
- Interne POI-Kategorien werden fuer Zuschauer in sichtbare Begriffe wie `Highlight`, `Sehenswuerdigkeit`, `Lokales Highlight`, `Naturhighlight`, `Etappenort` oder `Streckenmoment` uebersetzt.
- Eine zentrale Zuschauer-Kachel fasst jetzt zusammen, was am aktuellen Stand interessant ist, was als naechstes kommt und welche groesseren Highlights auf Makro-Ebene vor ihnen liegen.
- Die Struktur ist auf spaetere Anreicherung ueber OSM, Wikidata und Wikipedia vorbereitet.

## Navigation und Modulsteuerung

Die App nutzt Hash-Routing, damit sie ohne komplexes Setup direkt im Browser laeuft. In `src/config/modules.js` koennen Module:

- aktiviert oder deaktiviert werden
- in ihrer Reihenfolge angepasst werden
- fuer Dashboard-Teaser markiert werden
- in der Hauptnavigation priorisiert werden

## Lokal starten

Variante 1:

- `index.html` direkt im Browser oeffnen

Variante 2:

```bash
python3 -m http.server 4173
```

Danach im Browser `http://localhost:4173` aufrufen.

## CI/CD nach GitHub und Webspace

Die App kann jetzt automatisch ueber GitHub Actions per FTP auf deinen Webspace deployed werden.

Die Workflow-Datei liegt hier:

- [.github/workflows/deploy.yml](/Users/danielfink/Documents/zweiaufachse/.github/workflows/deploy.yml)

### So funktioniert der Ablauf

1. Du pushst nach `main`.
2. GitHub Actions prueft die statischen Projektdateien und fuehrt `node --check` fuer alle JS-Dateien aus.
3. Wenn die Pruefung erfolgreich ist, wird das Projekt per FTP auf deinen Webspace hochgeladen.

### GitHub Secrets anlegen

In GitHub unter `Settings -> Secrets and variables -> Actions -> New repository secret` diese Secrets anlegen:

- `FTP_SERVER`
  Beispiel: `ftp.deinedomain.de`
- `FTP_USERNAME`
  Dein dedizierter FTP-User
- `FTP_PASSWORD`
  Das FTP-Passwort
- `FTP_SERVER_DIR`
  Zielordner auf dem Webspace, zum Beispiel `/htdocs/zweiradchaos/`
- `FTP_PORT`
  Meist `21`

### Empfohlene Einrichtung auf GitHub

- Standard-Deploy-Branch: `main`
- Optional zusaetzlich Branch-Schutz fuer `main`, damit nur getestete Aenderungen live gehen
- Optional spaeter ein zweiter Workflow fuer `preview` oder `staging`

### Wichtige Hinweise

- Die App ist statisch, es gibt aktuell keinen Build-Schritt.
- Deployt wird direkt das Projektverzeichnis mit `index.html` und `src/`.
- `.github`, `.git`, `.DS_Store`, `README.md` und `node_modules` werden nicht hochgeladen.
- `dangerous-clean-slate` ist absichtlich deaktiviert, damit der Webspace nicht leergeraeumt wird.

### Manuelle Erstpruefung

Nach dem Anlegen der Secrets:

1. Repo nach GitHub pushen
2. Einen Push auf `main` ausloesen oder den Workflow manuell starten
3. In GitHub unter `Actions` pruefen, ob der Job erfolgreich durchlaeuft
4. Danach die Webspace-URL im Browser testen

### Sinnvolle naechste Ausbaustufe

Wenn du spaeter moechtest, koennen wir direkt als naechsten Schritt noch folgendes ergaenzen:

- `staging`-Deploy auf Unterordner oder Subdomain
- automatisches Setzen von Cache-Headern oder Datei-Versionierung
- Produktions- und Vorschau-Deploys mit getrennten Secrets
- optional FTPS oder SFTP, falls dein Webspace das unterstuetzt

## Sinnvolle naechste Iterationen

1. Echte Tagesposition auf der GPX-Route verankern statt Mock-Fortschritt
2. Etappen aus der Gesamtroute ableiten oder separat pflegen
3. Update-Feed direkt an Kilometerpunkte oder Routensegmente koppeln
4. Galerie mit echten Bildern und Lightbox
5. Admin- oder Content-Pflegefluss vorbereiten
6. Offline-Faehigkeit, PWA und Benachrichtigungen pruefen
