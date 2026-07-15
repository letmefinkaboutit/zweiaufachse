// Strava-Daten kommen ueber den serverseitigen Proxy (api/strava.php),
// weil Client-Secret und Refresh-Token nicht in den Browser gehoeren.
// Liefert: Lifetime-Summen, Tageswerte der Tour, Liste vergangener Touren.

const STRAVA_API_URL = "https://zweiaufachse.thefinks.de/api/strava.php";
const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

const EMPTY = {
  configured: false,
  totals: null,
  tripDays: {},
  tripTours: [],
  pastTours: [],
};

export async function fetchStravaSummary() {
  try {
    const response = await fetch(STRAVA_API_URL);
    if (!response.ok) {
      return { ...EMPTY, reason: `HTTP ${response.status}` };
    }

    const data = await response.json();
    if (!data.configured) {
      return { ...EMPTY, reason: data.reason ?? "Strava noch nicht eingerichtet." };
    }

    return {
      configured: true,
      totals: data.totals ?? null,
      tripDays: data.tripDays ?? {},
      tripTours: data.tripTours ?? [],
      pastTours: data.pastTours ?? [],
      updatedAt: data.updatedAt ?? null,
    };
  } catch (error) {
    return { ...EMPTY, reason: error instanceof Error ? error.message : "Strava nicht erreichbar." };
  }
}

export function startStravaService({ onUpdate }) {
  let intervalId = null;

  async function refresh() {
    onUpdate(await fetchStravaSummary());
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
