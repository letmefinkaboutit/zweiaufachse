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

// Persistent element — survives router.refresh() so images never reload unnecessarily
const _photoTileEl = document.createElement('a');
_photoTileEl.className = 'dashboard-focus-card dashboard-focus-card--photos';
_photoTileEl.href = '#/gallery';

function _renderPhotoTileContent(photos, photoLoading) {
  const header = `
    <div class="dashboard-focus-card__header">
      <div>
        <p class="section-intro__eyebrow">Fotos</p>
        <h3>Letzte Bilder von unterwegs</h3>
      </div>
    </div>
  `;

  if (photoLoading) {
    return header + `<p class="muted-text">Fotos werden geladen…</p>`;
  }

  if (!photos?.length) {
    return header + `<p class="muted-text">Noch keine Fotos hochgeladen.</p>`;
  }

  const highlight = photos[0];
  const rest = photos.slice(1, 5);
  const totalLabel = `${photos.length} Foto${photos.length !== 1 ? 's' : ''}`;

  const restItems = rest
    .map(
      (photo, i) => `
        <div class="photo-tile-small photo-tile-clickable"
          data-lightbox-src="${photo.url}"
          data-lightbox-caption="${photo.date ? new Date(photo.date).toLocaleString('de-DE') : ''}"
          data-lightbox-index="${i + 1}">
          <img src="${photo.url}" alt="${photo.filename}" loading="lazy" />
        </div>
      `,
    )
    .join('');

  return header + `
    <div class="photo-tile-grid">
      <div class="photo-tile-highlight photo-tile-clickable"
        data-lightbox-src="${highlight.url}"
        data-lightbox-caption="${highlight.date ? new Date(highlight.date).toLocaleString('de-DE') : ''}"
        data-lightbox-index="0">
        <img src="${highlight.url}" alt="${highlight.filename}" loading="lazy" />
      </div>
      <div class="photo-tile-secondary">
        ${restItems}
        <p class="photo-tile-count">${totalLabel} gesamt</p>
      </div>
    </div>
  `;
}

export function updatePhotoTile(photos, photoLoading) {
  _photoTileEl.innerHTML = _renderPhotoTileContent(photos, photoLoading);
}

export function mountPhotoTileObserver() {
  _photoTileEl.innerHTML = _renderPhotoTileContent([], true);
  const observer = new MutationObserver(() => {
    const slot = document.getElementById('photo-tile-slot');
    if (slot) {
      slot.parentNode?.replaceChild(_photoTileEl, slot);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
