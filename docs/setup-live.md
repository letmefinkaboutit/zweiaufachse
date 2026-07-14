# Go-Live: Traccar & Strava verbinden

Die Live-Ansicht (Startseite `/`) ist vollstaendig verdrahtet — sie enthaelt
keine erfundenen Werte mehr. Alles kommt aus echten Quellen:

| Modul | Quelle | Status |
|---|---|---|
| Live-Position, Tempo, Zustand | **Traccar** (via `api/traccar.php`) | ⬜ Config hochladen |
| Route, Fortschritt, Grenzen | `src/route/route-data.json` | ✅ live |
| Ortsname (Schild + Chip) | Nominatim (OSM) | ✅ live |
| Wetter (Szene + Chip) | Open-Meteo | ✅ live |
| Fotos (Slider, Box, Album) | `bilderupload/list.php` | ✅ live |
| Naechste POI | `src/poi/pois.min.json` | ✅ live |
| Tageskilometer heute | **Traccar** (Summary-Report) | ⬜ Config hochladen |
| Tageskilometer abgeschlossen | **Strava** | ⬜ Setup offen |
| Health & vergangene Touren | **Strava** | ⬜ Setup offen |

Solange Traccar/Strava fehlen, zeigt die App das ehrlich an
("Signal veraltet", "Strava noch nicht verbunden") statt Platzhalterzahlen.

---

## 1. Traccar (Traccar Cloud, über den PHP-Proxy)

Die App spricht **nicht** direkt mit Traccar, sondern über `api/traccar.php`
auf dem Webspace. Vorteile: der Token bleibt auf dem Server, es gibt kein
CORS-Problem, und die Tageskilometer werden serverseitig berechnet und gecacht.

> **Die App schaltet automatisch um.** Sobald `api/traccar-config.php` auf dem
> Server liegt, laeuft sie mit echtem GPS — kein Code-Deploy noetig. Fehlt die
> Datei, zeigt sie die Startposition mit dem Hinweis
> "📡 GPS noch nicht verbunden".

### a) Auf dem iPhone
- **Traccar Client** installieren, Server-URL `https://server.traccar.org` eintragen.
- Sendeintervall **30–60 s**, Genauigkeit "High".
- Die **Geraete-Kennung** (uniqueId) aus der App notieren.

### b) In Traccar Cloud
- Geraet mit dieser uniqueId anlegen (falls es sich nicht selbst meldet).
- API-Token erzeugen: *Einstellungen → Benutzer → eigenen Benutzer öffnen → Token*.

### c) Token als GitHub-Secret hinterlegen
Kein FTP noetig — der Deploy-Workflow schreibt `api/traccar-config.php`
selbst aus den Secrets (die Datei ist gitignored, das Secret landet nie im Repo).

*GitHub → Settings → Secrets and variables → Actions → New repository secret:*

| Secret | Wert |
|---|---|
| `TRACCAR_TOKEN` | der API-Token aus Traccar Cloud |
| `TRACCAR_DEVICE_ID` | *(optional)* Geraete-Kennung, Default: `88031483` |

Danach einmal deployen (Push auf `main` oder *Actions → Deploy Web App →
Run workflow*). Fehlt das Secret, warnt der Workflow und die App bleibt im
Mock-Modus — sie geht nie mit falschen Daten live.

Test: `https://zweiaufachse.thefinks.de/api/traccar.php` muss
`{"configured":true,"position":{…},"daily":{…}}` liefern.
Danach die App neu laden — die Fahrer stehen an der echten Position.

---

## 2. Strava

Strava braucht OAuth mit Client-Secret — das darf **nie** in den Browser.
Deshalb laeuft alles ueber `api/strava.php` auf dem Webspace.

### Strava-App anlegen
1. https://www.strava.com/settings/api → "Create App"
   (Authorization Callback Domain: `zweiaufachse.thefinks.de`).
2. **Client ID** und **Client Secret** notieren.

### Refresh-Token holen (einmalig)
1. Im Browser oeffnen (CLIENT_ID ersetzen):
   ```
   https://www.strava.com/oauth/authorize?client_id=CLIENT_ID&response_type=code&redirect_uri=http://localhost&approval_prompt=force&scope=activity:read_all
   ```
2. Nach dem Bestaetigen steht in der Adresszeile `?code=XYZ` — den Code kopieren.
3. Token tauschen:
   ```bash
   curl -X POST https://www.strava.com/oauth/token \
     -d client_id=CLIENT_ID -d client_secret=CLIENT_SECRET \
     -d code=XYZ -d grant_type=authorization_code
   ```
4. Aus der Antwort das **`refresh_token`** notieren (das laeuft nicht ab).

### Als GitHub-Secrets hinterlegen
Auch hier kein FTP — der Workflow erzeugt `api/strava-config.php` beim Deploy:

| Secret | Wert |
|---|---|
| `STRAVA_CLIENT_ID` | Client ID der Strava-App |
| `STRAVA_CLIENT_SECRET` | Client Secret |
| `STRAVA_REFRESH_TOKEN` | der oben geholte Refresh-Token |

`trip_start` setzt der Workflow automatisch auf **2026-07-19**.

Test: `https://zweiaufachse.thefinks.de/api/strava.php` muss
`{"configured":true,…}` liefern.

---

## 3. Restliche Schalter

- ✅ `tripMeta.startDate` steht auf **2026-07-19** (Sonntag) — muss mit
  `trip_start` in der Strava-Config uebereinstimmen.
- `.htaccess` auf dem Webspace: `Cache-Control: no-cache` fuer `*.js`/`*.css`/`*.json`.
- Temporaere Deploy-Versionsanzeige (unten rechts) am Tour-Ende entfernen:
  `index.html`, Ende von `src/styles/app.css`, Workflow-Step "Stamp deploy version".
