import { riderProfiles } from "../data/mockData.js";
import { createSectionIntro } from "../utils/format.js";
import { createProfileCard } from "../components/cards.js";

export function renderProfilesPage() {
  return `
    <div class="page-stack">
      ${createSectionIntro(
        "Fahrerprofile",
        "Wer sind Timo und Tino auf dieser Tour?",
        "Die Profile sind absichtlich menschlich, locker und schnell erfassbar aufgebaut.",
      )}

      <section class="profile-grid">
        ${riderProfiles.map((profile) => createProfileCard(profile)).join("")}
      </section>
    </div>
  `;
}
