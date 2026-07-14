# Go-Live: Traccar & Strava verbinden

Die Live-Ansicht (`/live/pov.html`) ist vollstaendig verdrahtet — sie enthaelt
keine erfundenen Werte mehr. Alles kommt aus echten Quellen:

| Modul | Quelle | Status |
|---|---|---|
| Live-Position, Tempo, Zustand | **Traccar** | ⬜ Setup offen |
| Route, Fortschritt, Grenzen | `src/route/route-data.json` | ✅ live |
| Ortsname (Schild + Chip) | Nominatim (OSM) | ✅ live |
| Wetter (Szene + Chip) | Open-Meteo | ✅ live |
| Fotos (Slider, Box, Album) | `bilderupload/list.php` | ✅ live |
| Naechste POI | `src/poi/pois.min.json` | ✅ live |
| Tageskilometer heute | **Traccar**-Verlauf | ⬜ mit Traccar |
| Tageskilometer abgeschlossen | **Strava** | ⬜ Setup offen |
| Health & vergangene Touren | **Strava** | ⬜ Setup offen |

Solange Traccar/Strava fehlen, zeigt die App das ehrlich an
("Signal veraltet", "Strava noch nicht verbunden") statt Platzhalterzahlen.

---

## 1. Traccar

### Auf dem Server
1. Read-only-Benutzer anlegen (der Token ist im Browser lesbar!).
2. API-Token erzeugen: *Einstellungen → Benutzer → Token*.
3. CORS fuer `https://zweiaufachse.thefinks.de` erlauben.
4. Report-Rechte pruefen — `tourStatsService` nutzt
   `GET /api/reports/summary` fuer die heutigen Kilometer.

### Auf dem iPhone
- **Traccar Client** installieren, Server-URL eintragen.
- Sendeintervall **30–60 s**, Genauigkeit "High".
- Geraet in Traccar mit `uniqueId` wiederfinden.

### In der App
`src/config/locationProvider.local.js` anlegen (gitignored, **manuell per FTP**
hochladen — der Deploy loescht sie nicht):

```js
export default {
  activeProvider: "traccar",
  traccar: {
    enabled: true,
    refreshIntervalMs: 30000,
    baseUrl: "https://dein-traccar-server.de/api",
    auth: { mode: "bearer", token: "DEIN-READONLY-TOKEN" },
    device: { deviceId: null, uniqueId: "DEINE-GERAETE-ID" },
  },
};
```

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

### Auf dem Webspace
`api/strava-config.php` anlegen (Vorlage: `api/strava-config.example.php`),
Werte eintragen und **manuell per FTP** hochladen:

```php
return [
    'client_id'     => '123456',
    'client_secret' => '…',
    'refresh_token' => '…',
    'trip_start'    => '2026-07-20',  // = tripMeta.startDate
];
```

Test: `https://zweiaufachse.thefinks.de/api/strava.php` muss
`{"configured":true,…}` liefern.

---

## 3. Restliche Schalter

- `tripMeta.startDate` in `src/data/mockData.js` auf den echten Starttag setzen
  (steuert "Tag N" und trennt Tour-Fahrten von "vergangenen Touren").
- `.htaccess` auf dem Webspace: `Cache-Control: no-cache` fuer `*.js`/`*.css`/`*.json`.
- Temporaere Deploy-Versionsanzeige (unten rechts) am Tour-Ende entfernen:
  `index.html`, Ende von `src/styles/app.css`, Workflow-Step "Stamp deploy version".
