import { startDailyStatsService } from "./traccarHistoryService.js";
import { startStravaService } from "./stravaService.js";

// Tageskilometer aus zwei Quellen (Entscheidung: "beides kombiniert"):
//   heute      → Traccar (live, waechst waehrend der Fahrt mit)
//   abgeschlossene Tage → Strava (die aufgezeichnete Etappe ist die Wahrheit)
// Faellt eine Quelle aus, springt die andere ein.

function localDateKey(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function startTourStatsService({ onUpdate }) {
  let traccar = { todayKm: null, yesterdayKm: null };
  let strava = { configured: false, tripDays: {}, totals: null, pastTours: [] };

  function emit() {
    const today = localDateKey(0);
    const yesterday = localDateKey(-1);

    const stravaToday = strava.tripDays?.[today]?.distanceKm ?? null;
    const stravaYesterday = strava.tripDays?.[yesterday]?.distanceKm ?? null;

    // Heute: Traccar fuehrt (live). Strava nur, wenn Traccar (noch) nichts hat.
    const todayKm = traccar.todayKm ?? stravaToday;
    // Gestern: Strava fuehrt (abgeschlossene Etappe). Traccar als Rueckfall.
    const yesterdayKm = stravaYesterday ?? traccar.yesterdayKm;

    onUpdate({
      todayKm,
      yesterdayKm,
      strava,
      sources: {
        today: traccar.todayKm != null ? "traccar" : stravaToday != null ? "strava" : null,
        yesterday: stravaYesterday != null ? "strava" : traccar.yesterdayKm != null ? "traccar" : null,
      },
    });
  }

  const traccarService = startDailyStatsService({
    onUpdate(stats) {
      traccar = stats;
      emit();
    },
  });

  const stravaService = startStravaService({
    onUpdate(summary) {
      strava = summary;
      emit();
    },
  });

  emit();

  return {
    stop() {
      traccarService.stop();
      stravaService.stop();
    },
  };
}
