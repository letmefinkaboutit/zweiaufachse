import { stories } from "../data/mockData.js";
import { createListCard, createStoryCard } from "../components/cards.js";
import { createSectionIntro } from "../utils/format.js";

export function renderStoriesPage() {
  return `
    <div class="page-stack">
      ${createSectionIntro(
        "Story & Entertainment",
        "Die Reise darf auch einfach Spass machen",
        "Hier sammeln wir kleine Geschichten, Running Gags und Bausteine fuer spaetere Votings oder Challenges.",
      )}

      <section class="story-grid">
        ${createListCard("Running Gags", stories.runningGags)}
        <article class="award-card">
          <p class="award-card__eyebrow">${stories.dailyAward.title}</p>
          <h3>${stories.dailyAward.winner}</h3>
          <p>${stories.dailyAward.reason}</p>
        </article>
      </section>

      <section class="story-grid">
        ${stories.storyCards.map((card) => createStoryCard(card)).join("")}
      </section>
    </div>
  `;
}
