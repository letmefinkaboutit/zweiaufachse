import { tripMeta } from "../data/mockData.js";
import { createElevationFigure, createRouteMapFigure, createRouteMilestones } from "../components/routeCards.js";
import { createJourneyTimelineCard } from "../components/journeyTimeline.js";

const COUNTRY_NAMES = {
  DE: "Deutschland", AT: "Österreich", IT: "Italien",
  SI: "Slowenien", HR: "Kroatien", BA: "Bosnien & Herzegowina",
  ME: "Montenegro", AL: "Albanien", MK: "Nordmazedonien", GR: "Griechenland",
};

const ICON_CHECK = `<svg class="rp-check-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3,8 7,12 13,4"/></svg>`;
const ICON_PIN   = `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1C5.24 1 3 3.24 3 6c0 3.9 5 9 5 9s5-5.1 5-9c0-2.76-2.24-5-5-5zm0 6.8a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6z"/></svg>`;
const ICON_UP    = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="8,13 8,3"/><polyline points="4,7 8,3 12,7"/></svg>`;
const ICON_DOWN  = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="8,3 8,13"/><polyline points="4,9 8,13 12,9"/></svg>`;
const ICON_ROAD  = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 14L6 2M11 14L10 2M6 2C6 2 8 4 10 2M6 14C6 14 8 12 10 14"/></svg>`;
const ICON_GLOBE = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6.5"/><path d="M8 1.5c-1.5 2-2.5 4-2.5 6.5s1 4.5 2.5 6.5"/><path d="M8 1.5c1.5 2 2.5 4 2.5 6.5s-1 4.5-2.5 6.5"/><line x1="1.5" y1="8" x2="14.5" y2="8"/></svg>`;
const ICON_MOUNTAIN = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="1,14 6,5 9,9 11,7 15,14"/></svg>`;

function getProgress(routeData, locationData) {
  if (locationData?.routeMatch) return locationData.routeMatch;
  return {
    progressRatio: routeData.currentProgress.ratio ?? 0,
    percentLabel: routeData.currentProgress.percentLabel,
    distanceDoneKm: routeData.currentProgress.distanceDoneKm,
    distanceDoneLabel: routeData.currentProgress.distanceDoneLabel,
    remainingKm: routeData.currentProgress.remainingKm,
    remainingLabel: routeData.currentProgress.remainingLabel,
  };
}

function createProgressHero(routeData, locationData, geocodeData) {
  const progress = getProgress(routeData, locationData);
  const pct = Math.round((progress.progressRatio ?? 0) * 100);
  const done = progress.distanceDoneLabel ?? "—";
  const remaining = progress.remainingLabel ?? "—";
  const total = routeData.totalDistanceLabel;

  const locationLine = geocodeData?.locationLabel
    ? `<p class="rp-location-line">${ICON_PIN} ${geocodeData.flag ?? ""} ${geocodeData.locationLabel}${geocodeData.state ? `, ${geocodeData.state}` : ""}</p>`
    : "";

  return `
    <div class="rp-hero">
      <div class="rp-hero__map">
        ${createRouteMapFigure(routeData, locationData)}
      </div>
      <div class="rp-hero__body">
        ${locationLine}
        <div class="rp-hero__progress-row">
          <span class="rp-hero__pct">${pct}<sup>%</sup></span>
          <div class="rp-hero__labels">
            <span class="rp-hero__done">${done} geschafft</span>
            <span class="rp-hero__rem">${remaining} verbleibend von ${total}</span>
          </div>
        </div>
        <div class="rp-progress-bar">
          <div class="rp-progress-bar__fill" style="width:${pct}%"></div>
          <div class="rp-progress-bar__glow" style="left:${pct}%"></div>
        </div>
      </div>
    </div>
  `;
}

function createQuickStats(routeData, locationData, countrySegments, dailyStats) {
  const progress = getProgress(routeData, locationData);
  const todayKm = dailyStats?.todayKm != null ? `${dailyStats.todayKm.toFixed(0)} km` : "—";
  const yesterdayKm = dailyStats?.yesterdayKm != null ? `${dailyStats.yesterdayKm.toFixed(0)} km` : "—";
  const countries = countrySegments?.length ?? "—";
  const pct = Math.round((progress.progressRatio ?? 0) * 100);

  const stats = [
    { icon: ICON_ROAD,     label: "Gesamt",           value: routeData.totalDistanceLabel },
    { icon: ICON_UP,       label: "Höhenmeter ↑",     value: routeData.elevationGainLabel },
    { icon: ICON_DOWN,     label: "Höhenmeter ↓",     value: routeData.elevationLossLabel },
    { icon: ICON_MOUNTAIN, label: "Höchster Punkt",   value: `${routeData.maxElevation} m` },
    { icon: ICON_GLOBE,    label: "Länder",            value: String(countries) },
    { icon: ICON_PIN,      label: "Heute gefahren",   value: todayKm },
    { icon: ICON_PIN,      label: "Gestern gefahren", value: yesterdayKm },
    { icon: ICON_CHECK,    label: "Fortschritt",       value: `${pct}%` },
  ];

  return `
    <div class="rp-stats-grid">
      ${stats.map(s => `
        <div class="rp-stat-card">
          <span class="rp-stat-card__icon">${s.icon}</span>
          <span class="rp-stat-card__value">${s.value}</span>
          <span class="rp-stat-card__label">${s.label}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function createCountryList(routeData, locationData, countrySegments) {
  if (!countrySegments?.length) return "";

  const progress = getProgress(routeData, locationData);
  const ratio = progress.progressRatio ?? 0;
  const total = routeData.totalDistanceKm;

  const items = countrySegments.map((seg) => {
    const km = Math.round((seg.toPercent - seg.fromPercent) * total);
    const pct = Math.round((seg.toPercent - seg.fromPercent) * 100);
    const name = COUNTRY_NAMES[seg.code] ?? seg.code;
    const isDone = seg.toPercent <= ratio;
    const isCurrent = !isDone && seg.fromPercent <= ratio;
    const modifier = isDone ? "is-done" : isCurrent ? "is-current" : "is-future";

    // How much of this segment is done
    const segProgress = isDone ? 1
      : isCurrent ? (ratio - seg.fromPercent) / (seg.toPercent - seg.fromPercent)
      : 0;

    const statusBadge = isDone
      ? `<span class="rp-country__badge rp-country__badge--done">${ICON_CHECK} Durch</span>`
      : isCurrent
        ? `<span class="rp-country__badge rp-country__badge--active">Aktuell</span>`
        : `<span class="rp-country__badge rp-country__badge--future">Kommt noch</span>`;

    return `
      <div class="rp-country ${modifier}">
        <span class="rp-country__flag">${seg.flag}</span>
        <div class="rp-country__info">
          <span class="rp-country__name">${name}</span>
          <span class="rp-country__meta">${km} km · ${pct > 1 ? pct + "%" : "< 1%"} der Route</span>
          <div class="rp-country__bar">
            <div class="rp-country__bar-fill" style="width:${Math.round(segProgress * 100)}%; background:${seg.color}"></div>
          </div>
        </div>
        ${statusBadge}
      </div>
    `;
  });

  return `
    <section class="rp-section">
      <h3 class="rp-section__title">${ICON_GLOBE} Länder (${countrySegments.length})</h3>
      <div class="rp-country-list">${items.join("")}</div>
    </section>
  `;
}

export function renderRoutePage(state = {}) {
  const { routeData, locationData, countrySegments, dailyStats, geocodeData,
          routeLoading, routeError } = state;

  if (routeLoading) {
    return `
      <div class="page-stack">
        <p class="muted-text" style="padding:32px 20px">Route wird geladen…</p>
      </div>
    `;
  }

  if (!routeData) {
    return `
      <div class="page-stack">
        <p class="muted-text" style="padding:32px 20px">${routeError ?? "Route nicht verfügbar."}</p>
      </div>
    `;
  }

  return `
    <div class="page-stack rp-page">

      <div class="rp-intro">
        <p class="section-intro__eyebrow">Reiseverlauf</p>
        <h2>${tripMeta.start} <span class="rp-intro__arrow">→</span> ${tripMeta.destination}</h2>
      </div>

      ${createProgressHero(routeData, locationData, geocodeData)}

      ${createQuickStats(routeData, locationData, countrySegments, dailyStats)}

      <section class="rp-section rp-section--timeline">
        <h3 class="rp-section__title">${ICON_MOUNTAIN} Zeitstrahl & Höhenprofil</h3>
        ${createJourneyTimelineCard(routeData, locationData, countrySegments ?? [], dailyStats ?? {})}
      </section>

      ${createCountryList(routeData, locationData, countrySegments ?? [])}

      <section class="rp-section">
        <h3 class="rp-section__title">${ICON_MOUNTAIN} Höhenprofil</h3>
        ${createElevationFigure(routeData)}
      </section>

      <section class="rp-section">
        <h3 class="rp-section__title">${ICON_CHECK} Meilensteine</h3>
        ${createRouteMilestones(routeData)}
      </section>

    </div>
  `;
}
