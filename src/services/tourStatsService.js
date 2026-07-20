import { startDailyStatsService } from "./traccarHistoryService.js";
import { startStravaService } from "./stravaService.js";

// Tageskilometer aus zwei Quellen (Entscheidung: "beides kombiniert"):
//   heute      → die groessere der beiden Zahlen (siehe emit())
//   abgeschlossene Tage → Strava (die aufgezeichnete Etappe ist die Wahrheit)
// Faellt eine Quelle aus, springt die andere ein.

function localDateKey(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Groesserer Wert samt Quelle, null-sicher. Bei Gleichstand gewinnt Strava,
// weil die aufgezeichnete Etappe die genauere Zahl ist.
function larger(traccarKm, stravaKm) {
  if (traccarKm == null && stravaKm == null) return { km: null, source: null };
  if (traccarKm == null) return { km: stravaKm, source: "strava" };
  if (stravaKm == null) return { km: traccarKm, source: "traccar" };
  return stravaKm >= traccarKm
    ? { km: stravaKm, source: "strava" }
    : { km: traccarKm, source: "traccar" };
}

export function startTourStatsService({ onUpdate }) {
  let traccar = { todayKm: null, yesterdayKm: null };
  let strava = { configured: false, tripDays: {}, tripTours: [], totals: null, pastTours: [] };

  function emit() {
    const today = localDateKey(0);
    const yesterday = localDateKey(-1);

    const stravaToday = strava.tripDays?.[today]?.distanceKm ?? null;
    const stravaYesterday = strava.tripDays?.[yesterday]?.distanceKm ?? null;

    // Heute: die groessere Zahl fuehrt. Waehrend der Fahrt ist das Traccar
    // (live), nach dem Upload uebernimmt die aufgezeichnete Etappe aus Strava.
    // Strava blind vorzuziehen wuerde an Tagen mit mehreren Etappen
    // untertreiben: die erste hochgeladene Etappe ersetzte dann den echten
    // Tagesstand, den Traccar laengst kennt.
    const todayPick = larger(traccar.todayKm, stravaToday);
    // Gestern: Strava fuehrt (abgeschlossene Etappe). Traccar als Rueckfall.
    const yesterdayKm = stravaYesterday ?? traccar.yesterdayKm;

    onUpdate({
      todayKm: todayPick.km,
      yesterdayKm,
      strava,
      sources: {
        today: todayPick.source,
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
