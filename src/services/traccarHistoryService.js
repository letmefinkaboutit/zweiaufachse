import { fetchTraccar } from "./traccarProxyService.js";

// Tageskilometer kommen vom Traccar-Proxy (api/traccar.php), der sie
// serverseitig aus dem Summary-Report holt und cacht. Der Kalendertag richtet
// sich nach der in der Server-Config gesetzten Zeitzone.

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function startDailyStatsService({ onUpdate }) {
  let intervalId = null;

  async function refresh() {
    const data = await fetchTraccar();

    onUpdate(
      data.configured && data.daily
        ? { todayKm: data.daily.todayKm ?? null, yesterdayKm: data.daily.yesterdayKm ?? null }
        : { todayKm: null, yesterdayKm: null },
    );
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
