// Zugriff auf Traccar laeuft ueber den serverseitigen Proxy (api/traccar.php):
// der Token bleibt auf dem Server, CORS entfaellt, Tageskilometer kommen
// fertig berechnet zurueck.
//
// Position und Tageswerte teilen sich eine Abfrage — Provider und Statistik
// greifen deshalb auf denselben kurzlebigen Cache zu.

const TRACCAR_API_URL = "https://zweiaufachse.thefinks.de/api/traccar.php";
const CACHE_TTL_MS = 10_000;

let cached = null;
let cachedAt = 0;
let inFlight = null;

const NOT_CONFIGURED = { configured: false, position: null, daily: { todayKm: null, yesterdayKm: null } };

export async function fetchTraccar({ force = false } = {}) {
  const fresh = cached && Date.now() - cachedAt < CACHE_TTL_MS;
  if (fresh && !force) {
    return cached;
  }

  if (inFlight) {
    return inFlight;
  }

  inFlight = (async () => {
    try {
      const response = await fetch(TRACCAR_API_URL, { cache: "no-store" });
      if (!response.ok) {
        return { ...NOT_CONFIGURED, reason: `HTTP ${response.status}` };
      }

      const data = await response.json();
      if (!data.configured) {
        return { ...NOT_CONFIGURED, reason: data.reason ?? "Traccar noch nicht eingerichtet." };
      }

      return {
        configured: true,
        position: data.position ?? null,
        daily: data.daily ?? { todayKm: null, yesterdayKm: null },
      };
    } catch (error) {
      return {
        ...NOT_CONFIGURED,
        reason: error instanceof Error ? error.message : "Traccar-Proxy nicht erreichbar.",
      };
    }
  })();

  try {
    cached = await inFlight;
    cachedAt = Date.now();
    return cached;
  } finally {
    inFlight = null;
  }
}

// Traccar-Position → internes Snapshot-Format (wie beim direkten Provider)
export function normalizeTraccarPosition(position) {
  if (!position || position.latitude == null || position.longitude == null) {
    return null;
  }

  return {
    providerType: "traccar",
    providerLabel: "Traccar",
    status: "connected",
    latitude: position.latitude,
    longitude: position.longitude,
    altitudeMeters: position.altitudeMeters ?? null,
    timestamp: position.timestamp ?? new Date().toISOString(),
    speedKph: position.speedKph ?? 0,
    course: position.course ?? null,
    batteryLevel: position.batteryLevel ?? null,
    accuracyMeters: position.accuracyMeters ?? null,
    motion: Boolean(position.motion),
    deviceName: position.deviceName ?? "Traccar-Geraet",
    note: "Live-Position aus Traccar.",
  };
}
