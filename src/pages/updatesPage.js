import { updates } from "../data/mockData.js";
import { createSectionIntro } from "../utils/format.js";
import { createUpdateCard } from "../components/cards.js";

export function renderUpdatesPage() {
  return `
    <div class="page-stack">
      ${createSectionIntro(
        "Tagesupdates",
        "Feed fuer Geschichten von unterwegs",
        "Hier sammeln wir Etappen, Pannen, Highlights, Essen, Wetter, Grenzen und Ruhetage in einem leicht lesbaren Verlauf.",
      )}

      <section class="feed-list">
        ${updates.map((item) => createUpdateCard(item)).join("")}
      </section>
    </div>
  `;
}
