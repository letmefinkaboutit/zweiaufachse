# Wie der Hase läuft – Live-Location-Tracker Erklärt

## Architektur: Provider-Pattern

Der Tracker ist als **austauschbares Provider-System** gebaut. In `src/location/LocationProvider.js` entscheidet eine Factory-Funktion anhand von `locationProviderConfig.activeProvider`, welcher Provider geladen wird:

```
"mock"    → MockProvider   (simuliert Position entlang der Route)
"traccar" → TraccarProvider (echter GPS-Empfänger via Traccar-Server)
```

---

## Jeder Provider hat dieselbe Schnittstelle

```js
provider.start()   // startet Polling-Intervall, ruft sofort das erste Update ab
provider.stop()    // räumt setInterval auf (bei Page-Unload)
```

Beim `start()` wird sofort ein Update ausgelöst, danach läuft ein `setInterval` im konfigurierten Rhythmus.

---

## TraccarProvider – wie er funktioniert

**Traccar** ist eine Open-Source GPS-Tracking-Software. Das Smartphone/Gerät sendet seine Position aktiv an den Traccar-Server. Die Webapp *pollt* dann regelmäßig die REST-API:

```
Gerät (GPS-App) → Traccar-Server
                         ↑ REST-Polling alle 30s
                    Deine Webapp
```

**Ablauf pro Poll** (`src/location/providers/TraccarProvider.js`):
1. `resolveDevice()` → findet das Gerät per `deviceId` oder `uniqueId` via `GET /devices`
2. `fetchLatestPosition()` → holt die letzte Position via `GET /positions?id={positionId}`
3. `normalizeTraccarSnapshot()` → wandelt Traccar-Felder in das interne Snapshot-Format um
4. `onUpdate(snapshot)` → gibt das normalisierte Snapshot weiter

**Authentifizierung:** Bearer-Token oder Basic Auth (Email + Passwort).

**Hinweis zum Speed-Feld:** Traccar liefert Geschwindigkeit in **Knoten** – der Code multipliziert korrekt mit `1.852` für km/h.

---

## Was passiert nach jedem Location-Update? (`src/app/app.js`)

```
onUpdate(snapshot)
  ├── mapLocationToRoute()     → Schnappspunkt auf Route projizieren (Fortschritt, km übrig)
  ├── appendToHistory()        → in localStorage speichern (max alle 5 min)
  ├── computeDailyStats()      → Tages-km berechnen
  ├── updateLiveMap()          → Leaflet-Karte aktualisieren
  ├── reverseGeocode()         → Ortsname via Nominatim (rate-limited: 90s)
  └── fetchOverpassPois()      → nahegelegene POIs via OSM Overpass (gecacht: 30min)
```

---

## MockProvider – für Tests

Simuliert Bewegung entlang der GPX-Route mit konfigurierbarem Startpunkt (`baseProgressRatio`) und Geschwindigkeit. Aktuell: alle **9 Sekunden** ein Update. Nützlich zum UI-Testen ohne echtes GPS.

---

## Optimale Konfiguration für Live-Betrieb

### Traccar aktivieren

In `src/config/locationProvider.js`:

```js
export const locationProviderConfig = {
  activeProvider: "traccar",          // ← von "mock" auf "traccar"
  traccar: {
    enabled: true,                    // ← true setzen
    refreshIntervalMs: 30000,         // 30s ist gut für Radreise
    baseUrl: "https://dein-traccar-server.de/api",
    auth: {
      mode: "bearer",
      token: "dein-api-token",        // ← in Traccar unter Einstellungen > API-Token
    },
    device: {
      deviceId: null,
      uniqueId: "dein-geraet-id",    // ← uniqueId des Geräts in Traccar
    },
  },
};
```

### Polling-Intervall richtig wählen

| Szenario | `refreshIntervalMs` | Begründung |
|---|---|---|
| Radreise (aktiv) | `30000` (30s) | GPS-App sendet eh meist alle 30–60s, häufigeres Polling bringt nichts |
| Pausiert/Nacht | `60000` (60s) | Spart API-Calls, Daten ändern sich kaum |
| Demo/Präsentation | `15000` (15s) | Lebendiger für Beobachter |

### Traccar-App auf dem Gerät konfigurieren

Das Gerät (Smartphone) braucht eine GPS-Tracking-App (z.B. **Traccar Client** für iOS/Android) mit:
- Server-URL: deine Traccar-Instanz
- **Sendeintervall: 30–60s** — passt zum Webapp-Polling
- Positionsgenauigkeit: "High Accuracy" / GPS-Modus

### CORS-Problem vermeiden

Wenn der Traccar-Server CORS-Header nicht korrekt setzt, schlägt das Polling aus dem Browser fehl. Entweder:
- Traccar korrekt konfigurieren (CORS für deine Domain erlauben)
- Oder einen kleinen **Proxy** (z.B. Cloudflare Worker) vorschalten

---

## Zusammenfassung

Der Tracker ist sauber gebaut — Provider wechseln, `enabled: true` setzen, Credentials eintragen, fertig. Das **30s-Intervall** ist für eine Fahrradreise ideal. Das größte Risiko im Live-Betrieb ist **CORS**, falls der Traccar-Server nicht unter deiner eigenen Domain läuft.
