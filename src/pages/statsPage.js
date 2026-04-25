import { stats } from "../data/mockData.js";
import { createSectionIntro } from "../utils/format.js";
import { createStatCard } from "../components/cards.js";

export function renderStatsPage(state = {}) {
  const routeDrivenStats = state.routeData
    ? [
        { label: "GPX-Gesamtdistanz", value: state.routeData.totalDistanceLabel, tone: "primary" },
        { label: "GPX-Aufstieg", value: state.routeData.elevationGainLabel, tone: "primary" },
        { label: "Fortschritt", value: state.routeData.currentProgress.percentLabel, tone: "calm" },
        { label: "Rest bis Griechenland", value: state.routeData.currentProgress.remainingLabel, tone: "calm" },
      ]
    : [];

  const statEntries = [...routeDrivenStats, ...stats];

  return `
    <div class="page-stack">
      ${createSectionIntro(
        "Statistiken",
        "Zahlen zwischen echter Route und halb ernstem Reisewahnsinn",
        "Oben stehen jetzt direkt aus der GPX-Datei abgeleitete Werte. Darunter bleibt Platz fuer Running-Gag-Statistiken.",
      )}

      <section class="stats-grid">
        ${statEntries.map((entry) => createStatCard(entry)).join("")}
      </section>
    </div>
  `;
}
