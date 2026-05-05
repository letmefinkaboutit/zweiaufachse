import { createPhotoRouteSvg } from "../components/routeCards.js";

function renderGridTab(photos, photoLoading, photoError) {
  if (photoLoading) {
    return `<p class="muted-text">Fotos werden geladen…</p>`;
  }
  if (photoError) {
    return `<p class="muted-text">Fehler: ${photoError}</p>`;
  }
  if (!photos.length) {
    return `<p class="muted-text">Noch keine Fotos vorhanden.</p>`;
  }

  const byDay = new Map();
  for (const photo of photos) {
    const key = photo.date ? photo.date.slice(0, 10) : 'unknown';
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(photo);
  }

  const groups = [...byDay.entries()]
    .map(([key, dayPhotos]) => {
      const label =
        key === 'unknown'
          ? 'Datum unbekannt'
          : new Date(key).toLocaleDateString('de-DE', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            });

      const imgs = dayPhotos
        .map(
          (photo) => `
            <button
              class="gallery-photo-btn"
              data-lightbox-src="${photo.url}"
              data-lightbox-caption="${photo.date ? new Date(photo.date).toLocaleString('de-DE') : ''}"
              aria-label="${photo.filename}"
            >
              <img src="${photo.url}" alt="${photo.filename}" loading="lazy" />
            </button>
          `,
        )
        .join('');

      return `
        <div class="gallery-day-group">
          <h4 class="gallery-day-label">${label}</h4>
          <div class="gallery-photo-grid">${imgs}</div>
        </div>
      `;
    })
    .join('');

  return `<div class="gallery-grid-view">${groups}</div>`;
}

function renderMapTab(photos) {
  const noGps = photos.filter((p) => p.lat == null || p.lon == null);

  const noGpsList = noGps.length
    ? `
      <div class="gallery-no-gps">
        <p class="muted-text">Fotos ohne GPS (${noGps.length}):</p>
        <div class="gallery-photo-grid">
          ${noGps
            .map(
              (p) => `
            <button class="gallery-photo-btn" data-lightbox-src="${p.url}" data-lightbox-caption="${p.filename}">
              <img src="${p.url}" alt="${p.filename}" loading="lazy" />
            </button>
          `,
            )
            .join('')}
        </div>
      </div>
    `
    : '';

  return `
    <div class="gallery-map-view">
      <div id="gallery-map-placeholder" class="gallery-map-el"></div>
      ${noGpsList}
    </div>
  `;
}

function renderRouteTab(photos, routeData, locationData) {
  if (!routeData) {
    return `<p class="muted-text">Route wird noch geladen…</p>`;
  }
  const withGps = photos.filter((p) => p.lat != null && p.lon != null);
  if (!withGps.length) {
    return `<p class="muted-text">Noch keine Fotos mit GPS-Daten vorhanden.</p>`;
  }
  return createPhotoRouteSvg(routeData, locationData, photos);
}

export function renderGalleryPage(state = {}) {
  const {
    photoData: photos = [],
    photoLoading,
    photoError,
    galleryTab = 'grid',
    routeData,
    locationData,
  } = state;

  const tabs = [
    { id: 'grid', label: 'Fotos' },
    { id: 'map', label: 'Karte' },
    { id: 'route', label: 'Route' },
  ];

  const tabBar = `
    <div class="gallery-tabs">
      ${tabs
        .map(
          (t) => `
        <button
          class="gallery-tab${galleryTab === t.id ? ' is-active' : ''}"
          data-gallery-tab="${t.id}"
        >${t.label}</button>
      `,
        )
        .join('')}
    </div>
  `;

  const content =
    galleryTab === 'map'
      ? renderMapTab(photos)
      : galleryTab === 'route'
        ? renderRouteTab(photos, routeData, locationData)
        : renderGridTab(photos, photoLoading, photoError);

  return `
    <div class="page-stack">
      <div class="section-intro">
        <p class="section-intro__eyebrow">Galerie</p>
        <h2>Fotos von unterwegs</h2>
      </div>
      ${tabBar}
      ${content}
      <dialog id="photo-lightbox" class="photo-lightbox">
        <button class="photo-lightbox__close" data-lightbox-close aria-label="Schliessen">&#x2715;</button>
        <img class="photo-lightbox__img" src="" alt="" />
        <p class="photo-lightbox__caption"></p>
      </dialog>
    </div>
  `;
}
