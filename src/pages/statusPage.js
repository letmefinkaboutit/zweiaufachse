import { liveStatus } from "../data/mockData.js";
import { createSectionIntro, createTag } from "../utils/format.js";
import { createStatusPanel } from "../components/cards.js";

export function renderStatusPage(state = {}) {
  const liveProviderNote = state.locationData
    ? `Live-Signal via ${state.locationData.providerLabel} von ${state.locationData.deviceName}.`
    : "Noch kein Live-Signal verfuegbar.";

  return `
    <div class="page-stack">
      ${createSectionIntro(
        "Live-Status",
        "Wie steht es gerade um die Tour?",
        `Dieses Modul ist fuer spaetere manuelle oder automatische Statusmeldungen vorbereitet. ${liveProviderNote}`,
      )}

      ${createStatusPanel({
        label: liveStatus.headline,
        summary: liveStatus.summary,
        cards: liveStatus.cards,
      })}

      <section class="list-inline-card">
        <h3>Moegliche Statuswerte</h3>
        <div class="tag-row">
          ${liveStatus.possibleStates.map((state) => createTag(state, "neutral")).join("")}
        </div>
      </section>
    </div>
  `;
}
