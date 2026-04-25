import { createTag } from "../utils/format.js";

export function createHeroCard({ eyebrow, title, text, meta }) {
  return `
    <article class="hero-card">
      <p class="hero-card__eyebrow">${eyebrow}</p>
      <h2>${title}</h2>
      <p class="hero-card__text">${text}</p>
      <p class="hero-card__meta">${meta}</p>
    </article>
  `;
}

export function createInfoCard({ title, value, detail }) {
  return `
    <article class="info-card">
      <p class="info-card__title">${title}</p>
      <h3>${value}</h3>
      <p class="info-card__detail">${detail}</p>
    </article>
  `;
}

export function createModuleTile(module) {
  return `
    <a class="module-tile" href="#${module.route}">
      <span class="module-tile__index">${module.shortLabel}</span>
      <h3>${module.title}</h3>
      <p>${module.description}</p>
    </a>
  `;
}

export function createStatCard(stat) {
  return `
    <article class="stat-card stat-card--${stat.tone || "primary"}">
      <p>${stat.label}</p>
      <h3>${stat.value}</h3>
    </article>
  `;
}

export function createUpdateCard(update) {
  return `
    <article class="feed-card">
      <div class="feed-card__header">
        ${createTag(update.category, "accent")}
        <span>${update.date}</span>
      </div>
      <h3>${update.title}</h3>
      <p>${update.text}</p>
      ${
        update.hasImage
          ? `<div class="media-placeholder"><span>Bildplatzhalter</span></div>`
          : ""
      }
    </article>
  `;
}

export function createGalleryCard(item) {
  return `
    <article class="gallery-card">
      <div class="gallery-card__media">
        <span>${item.type}</span>
      </div>
      <h3>${item.title}</h3>
      <p>${item.caption}</p>
    </article>
  `;
}

export function createProfileCard(profile) {
  return `
    <article class="profile-card">
      <div class="profile-card__header">
        <div class="profile-card__avatar">${profile.name.slice(0, 2)}</div>
        <div>
          <h3>${profile.name}</h3>
          <p>${profile.nickname}</p>
        </div>
      </div>
      <p class="profile-card__role">${profile.role}</p>
      <p>${profile.description}</p>
      <div class="profile-card__traits">
        <div>
          <h4>Staerken</h4>
          <ul>${profile.strengths.map((entry) => `<li>${entry}</li>`).join("")}</ul>
        </div>
        <div>
          <h4>Schwaechen</h4>
          <ul>${profile.weaknesses.map((entry) => `<li>${entry}</li>`).join("")}</ul>
        </div>
      </div>
    </article>
  `;
}

export function createStatusPanel({ label, summary, cards }) {
  return `
    <section class="status-panel">
      <div class="status-panel__headline">
        ${createTag(label, "success")}
        <h3>Aktueller Status: ${label}</h3>
      </div>
      <p>${summary}</p>
      <div class="status-panel__grid">
        ${cards.map((card) => createInfoCard({ title: card.label, value: card.value, detail: "Spaeter live aktualisierbar" })).join("")}
      </div>
    </section>
  `;
}

export function createListCard(title, items) {
  return `
    <article class="list-card">
      <h3>${title}</h3>
      <ul>
        ${items.map((item) => `<li>${item}</li>`).join("")}
      </ul>
    </article>
  `;
}

export function createStoryCard(card) {
  return `
    <article class="story-card">
      <h3>${card.title}</h3>
      <p>${card.text}</p>
    </article>
  `;
}
