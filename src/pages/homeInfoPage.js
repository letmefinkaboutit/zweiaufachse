import { homeInfo } from "../data/mockData.js";
import { createListCard } from "../components/cards.js";
import { createSectionIntro } from "../utils/format.js";

export function renderHomeInfoPage() {
  return `
    <div class="page-stack">
      ${createSectionIntro(
        "Info fuer Daheimgebliebene",
        "Einfach erklaert und schnell gefunden",
        homeInfo.intro,
      )}

      <section class="story-grid">
        ${createListCard("So verfolgt man die Reise", homeInfo.followSteps)}
        ${createListCard("Wichtige Hinweise", homeInfo.notes)}
      </section>
    </div>
  `;
}
