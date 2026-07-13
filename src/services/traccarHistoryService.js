import { locationProviderConfig } from "../config/locationProvider.js";

// Tages-Kilometer direkt aus Traccar (Summary-Report), Referenz = Kalendertag.
// Damit sieht jeder Betrachter dieselben echten Zahlen — egal, wann er die
// App oeffnet. Ersetzt den frueheren localStorage-Ansatz, der nur die
// Bewegung waehrend der eigenen Browser-Session erfassen konnte.

const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

function createAuthHeaders(auth) {
  const headers = { Accept: "application/json" };

  if (auth.mode === "bearer" && auth.token) {
    headers.Authorization = `Bearer ${auth.token}`;
  }

  if (auth.mode === "basic" && auth.email && auth.password) {
    headers.Authorization = `Basic ${btoa(`${auth.email}:${auth.password}`)}`;
  }

  return headers;
}

async function fetchJson(url, auth) {
  const response = await fetch(url, { headers: createAuthHeaders(auth) });

  if (!response.ok) {
    throw new Error(`Traccar antwortete mit Status ${response.status}.`);
  }

  return response.json();
}

// Kalendertag in lokaler Zeit des Betrachters (Familie in Deutschland,
// Fahrer maximal eine Zeitzone weiter — fuer Tages-km voellig ausreichend).
function dayRange(offsetDays) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + offsetDays);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    from: start.toISOString(),
    to: (offsetDays === 0 ? new Date() : end).toISOString(),
  };
}

async function fetchDayKm(config, deviceId, offsetDays) {
  const { from, to } = dayRange(offsetDays);
  const url =
    `${config.baseUrl}/reports/summary` +
    `?deviceId=${encodeURIComponent(deviceId)}` +
    `&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

  const summaries = await fetchJson(url, config.auth);

  // Leere Antwort = keine Positionen im Zeitraum = 0 km gefahren.
  if (!Array.isArray(summaries) || !summaries.length) {
    return 0;
  }

  const distanceMeters = summaries[0]?.distance ?? 0;
  return distanceMeters / 1000;
}

async function resolveDeviceId(config) {
  if (config.device.deviceId) {
    return config.device.deviceId;
  }

  const devices = await fetchJson(
    `${config.baseUrl}/devices?uniqueId=${encodeURIComponent(config.device.uniqueId)}`,
    config.auth,
  );

  return devices[0]?.id ?? null;
}

export function startDailyStatsService({ onUpdate }) {
  const config = locationProviderConfig.traccar;

  if (locationProviderConfig.activeProvider !== "traccar" || !config.enabled) {
    // Ohne Traccar gibt es keine verlaesslichen Tageswerte — lieber "–" als
    // falsche Zahlen (Mock-Modus / lokale Entwicklung).
    onUpdate({ todayKm: null, yesterdayKm: null });
    return { stop() {} };
  }

  let intervalId = null;
  let deviceId = null;

  async function refresh() {
    try {
      if (deviceId == null) {
        deviceId = await resolveDeviceId(config);
      }

      if (deviceId == null) {
        return;
      }

      const [todayKm, yesterdayKm] = await Promise.all([
        fetchDayKm(config, deviceId, 0),
        fetchDayKm(config, deviceId, -1),
      ]);

      onUpdate({ todayKm, yesterdayKm });
    } catch {
      // Letzten bekannten Stand behalten; naechster Intervall-Lauf versucht es erneut.
    }
  }

  refresh();
  intervalId = window.setInterval(refresh, REFRESH_INTERVAL_MS);

  return {
    stop() {
      if (intervalId) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    },
  };
}
