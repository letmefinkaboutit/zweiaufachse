function createCategoryOptions(categories, selectedCategory) {
  return [
    `<option value="all"${selectedCategory === "all" ? " selected" : ""}>Alle Kategorien</option>`,
    ...categories.map(
      (category) =>
        `<option value="${category}"${selectedCategory === category ? " selected" : ""}>${category}</option>`,
    ),
  ].join("");
}

function createProximityOptions(selectedValue) {
  const options = [
    ["all", "Alle Distanzen"],
    ["on_route_or_very_close", "Direkt an der Route"],
    ["near_route", "Nahe der Route"],
    ["optional_detour", "Mit Abstecher"],
  ];

  return options
    .map(
      ([value, label]) => `<option value="${value}"${selectedValue === value ? " selected" : ""}>${label}</option>`,
    )
    .join("");
}

function createHighlightOptions(selectedValue) {
  const options = [
    ["highlights_only", "Nur Highlights"],
    ["strong_candidate_plus", "Starke Kandidaten+"],
    ["context_plus", "Mit Kontext-POIs"],
  ];

  return options
    .map(
      ([value, label]) => `<option value="${value}"${selectedValue === value ? " selected" : ""}>${label}</option>`,
    )
    .join("");
}

function createScoreOptions(selectedValue) {
  const options = [
    [0.65, "Score ab 0.65"],
    [0.55, "Score ab 0.55"],
    [0.35, "Score ab 0.35"],
    [0.15, "Score ab 0.15"],
  ];

  return options
    .map(
      ([value, label]) =>
        `<option value="${value}"${Number(selectedValue) === Number(value) ? " selected" : ""}>${label}</option>`,
    )
    .join("");
}

function formatKm(value) {
  return typeof value === "number" ? `${value.toFixed(0)} km` : "k. A.";
}

function getPoiBreadcrumbMeta(poi) {
  const viewerCategory = poi.viewerCategory || "Highlight";

  switch (viewerCategory) {
    case "Nationalpark":
    case "Naturhighlight":
    case "Aussichtspunkt":
      return {
        family: "Natur",
        tone: "nature",
        label: viewerCategory,
      };
    case "Sehenswuerdigkeit":
    case "Highlight-Stadt":
    case "Kulturort":
      return {
        family: "Kultur",
        tone: "culture",
        label: viewerCategory,
      };
    case "Etappenort":
    case "Ankommen":
      return {
        family: "Etappe",
        tone: "stage",
        label: viewerCategory,
      };
    case "Grenze":
      return {
        family: "Uebergang",
        tone: "border",
        label: viewerCategory,
      };
    case "Pause & Versorgung":
      return {
        family: "Pause",
        tone: "supply",
        label: viewerCategory,
      };
    case "Streckenmoment":
      return {
        family: "Route",
        tone: "route",
        label: viewerCategory,
      };
    case "Lokales Highlight":
      return {
        family: "Vor Ort",
        tone: "local",
        label: viewerCategory,
      };
    default:
      return {
        family: "Highlight",
        tone: "highlight",
        label: viewerCategory,
      };
  }
}

const TONE_COLOR = {
  nature:    "#3a8b37",
  culture:   "#c47a1e",
  stage:     "#2c6fad",
  border:    "#8a5ca7",
  supply:    "#1a8a72",
  route:     "#6a6a6a",
  local:     "#c4863a",
  highlight: "#eb8f34",
};

function createPoiBreadcrumb(poi) {
  const breadcrumb = getPoiBreadcrumbMeta(poi);

  return `
    <div class="poi-breadcrumb poi-breadcrumb--${breadcrumb.tone}" aria-label="POI-Kategorie">
      <span>${breadcrumb.label}</span>
    </div>
  `;
}

function createPoiCompactRow(poi) {
  const { label, tone } = getPoiBreadcrumbMeta(poi);
  const color = TONE_COLOR[tone] || TONE_COLOR.highlight;
  const dist = poi.relativeToLiveLabel || "";
  return `
    <div class="poi-compact-row">
      <span class="poi-compact-row__dot" style="background:${color}"></span>
      <span class="poi-compact-row__name">${poi.name}</span>
      <span class="poi-compact-row__badge" style="color:${color}">${label}</span>
      <span class="poi-compact-row__dist">${dist}</span>
    </div>
  `;
}

function createPoiLeadItem(poi) {
  const { label, tone } = getPoiBreadcrumbMeta(poi);
  const color = TONE_COLOR[tone] || TONE_COLOR.highlight;
  return `
    <div class="poi-lead-item">
      <div class="poi-lead-item__meta">
        <span class="poi-compact-row__badge" style="color:${color}">${label}</span>
        <span class="poi-lead-item__dist">${poi.relativeToLiveLabel || ""}</span>
      </div>
      <strong class="poi-lead-item__name">${poi.name}</strong>
    </div>
  `;
}

function createPoiListItem(poi) {
  return `
    <article class="poi-card">
      <div class="poi-card__header">
        <div>
          <p class="poi-card__eyebrow">${poi.country}</p>
          <h3>${poi.name}</h3>
        </div>
        <div class="poi-card__header-meta">
          ${createPoiBreadcrumb(poi)}
          <span class="poi-card__score">${poi.score.toFixed(3)}</span>
        </div>
      </div>
      <p class="poi-card__description">${poi.shortDescription}</p>
      <p class="poi-card__meta">
        Route km ~${formatKm(poi.routeKm)} | ${poi.relativeToLiveLabel || "noch ohne Live-Bezug"} | ${poi.highlightLevel}
      </p>
      <p class="poi-card__impact">${poi.whyItMattersForApp}</p>
    </article>
  `;
}

function createJourneyPoiItem(poi, label) {
  return `
    <article class="poi-journey-card">
      <div class="poi-inline-header">
        <p class="poi-card__eyebrow">${label}</p>
        ${createPoiBreadcrumb(poi)}
      </div>
      <h4>${poi.name}</h4>
      <p class="poi-card__meta">Route km ~${formatKm(poi.routeKm)} | ${poi.relativeToLiveLabel || "noch ohne Live-Bezug"} | ${poi.viewerCategory}</p>
      <p class="poi-card__description">${poi.shortDescription}</p>
    </article>
  `;
}

function createCompactAudienceItem(poi) {
  return `
    <article class="poi-audience-item">
      <div class="poi-inline-header">
        <p class="poi-card__eyebrow">Zuschauerblick</p>
        ${createPoiBreadcrumb(poi)}
      </div>
      <h4>${poi.name}</h4>
      <p class="poi-card__meta">${poi.relativeToLiveLabel || "noch ohne Live-Bezug"} | Route km ~${formatKm(poi.routeKm)}</p>
    </article>
  `;
}

function createMiniAudienceItem(poi) {
  return `
    <article class="dashboard-poi-item">
      <div class="poi-inline-header">
        <p class="poi-card__eyebrow">POI</p>
        ${createPoiBreadcrumb(poi)}
      </div>
      <h4>${poi.name}</h4>
      <p class="poi-card__meta">${poi.relativeToLiveLabel || "noch ohne Live-Bezug"}</p>
    </article>
  `;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearbyDistLabel(km) {
  if (km < 0.3) return "direkt bei Timo & Tino";
  if (km < 1) return `${Math.round(km * 1000)} m entfernt`;
  return `${km.toFixed(1).replace(".", ",")} km entfernt`;
}

export function createNearbyOverpassTile(overpassPois, locationData) {
  const lat = locationData?.latitude;
  const lon = locationData?.longitude;

  const loading = overpassPois === null && lat != null;

  const items = (overpassPois || [])
    .filter((p) => p.latitude != null && p.longitude != null)
    .map((p) => {
      const dist = lat != null ? haversineKm(lat, lon, p.latitude, p.longitude) : Infinity;
      return { ...p, _dist: dist, relativeToLiveLabel: dist < Infinity ? nearbyDistLabel(dist) : "" };
    })
    .sort((a, b) => a._dist - b._dist)
    .slice(0, 7);

  return `
    <div class="dashboard-focus-card">
      <div class="dashboard-focus-card__header">
        <div>
          <p class="section-intro__eyebrow">Jetzt hier</p>
          <h3>Was ist spannend?</h3>
        </div>
      </div>
      ${loading
        ? `<p class="muted-text">POIs werden geladen…</p>`
        : items.length
          ? `<div class="poi-compact-list">${items.map(createPoiCompactRow).join("")}</div>`
          : `<p class="muted-text">Keine POIs in der Nähe gefunden.</p>`
      }
    </div>
  `;
}

export function createCurrentAudienceTile(audienceContext) {
  const items = audienceContext?.currentArea || [];
  const lead = items[0] || audienceContext?.currentLead || null;
  const supporting = items.slice(1, 3);

  return `
    <a class="dashboard-focus-card" href="#route">
      <div class="dashboard-focus-card__header">
        <div>
          <p class="section-intro__eyebrow">Jetzt hier</p>
          <h3>Was ist spannend?</h3>
        </div>
      </div>
      ${lead
        ? `
          ${createPoiLeadItem(lead)}
          ${supporting.length ? `<div class="poi-compact-list">${supporting.map(createPoiCompactRow).join("")}</div>` : ""}
        `
        : `<p class="muted-text">Gerade ein ruhiger Abschnitt.</p>`
      }
    </a>
  `;
}

export function createForwardAudienceTile(audienceContext) {
  const items = (audienceContext?.nextHundredKm || []).slice(0, 5);

  return `
    <a class="dashboard-focus-card" href="#route">
      <div class="dashboard-focus-card__header">
        <div>
          <p class="section-intro__eyebrow">Voraus</p>
          <h3>Was kommt als nächstes?</h3>
        </div>
      </div>
      ${items.length
        ? `<div class="poi-compact-list">${items.map(createPoiCompactRow).join("")}</div>`
        : `<p class="muted-text">Noch keine POIs für die nächste Etappe hinterlegt.</p>`
      }
    </a>
  `;
}

export function createPoiSummaryCard(poiData, visiblePois, journeyGroups) {
  return `
    <section class="timeline-card">
      <h3>POI-Layer</h3>
      <div class="provider-grid">
        <article class="info-card">
          <p class="info-card__title">Gesamte POI-Basis</p>
          <h3>${poiData.summary.total}</h3>
          <p class="info-card__detail">${poiData.summary.curatedSeedCount} kuratiert, ${poiData.summary.routeAnchorCount} Route-Anker</p>
        </article>
        <article class="info-card">
          <p class="info-card__title">Aktuell sichtbar</p>
          <h3>${visiblePois.length}</h3>
          <p class="info-card__detail">Im MVP standardmaessig auf hochwertige Eintraege reduziert und auf die Live-Position bezogen.</p>
        </article>
        <article class="info-card">
          <p class="info-card__title">Gerade voraus</p>
          <h3>${journeyGroups.upcoming.length}</h3>
          <p class="info-card__detail">POIs, die als naechstes auf der aktuellen Route vor euch liegen.</p>
        </article>
        <article class="info-card">
          <p class="info-card__title">Im aktuellen Fenster</p>
          <h3>${journeyGroups.currentWindow.length}</h3>
          <p class="info-card__detail">${journeyGroups.currentKm === null ? poiData.meta.dataQualityWarning : `Rund um den Live-Stand bei etwa km ${journeyGroups.currentKm.toFixed(0)}`}</p>
        </article>
      </div>
    </section>
  `;
}

export function createPoiFilterCard(poiData, filters) {
  return `
    <section class="poi-filter-card">
      <div class="poi-filter-card__heading">
        <div>
          <p class="section-intro__eyebrow">POI-Filter</p>
          <h3>Welche Orte sollen sichtbar sein?</h3>
        </div>
        <p class="muted-text">Anker und unvollstaendige POIs bleiben erhalten, sind aber zunaechst ausgeblendet.</p>
      </div>

      <div class="poi-filter-grid">
        <label class="poi-filter-field">
          <span>Mindest-Score</span>
          <select data-poi-filter="minScore">
            ${createScoreOptions(filters.minScore)}
          </select>
        </label>

        <label class="poi-filter-field">
          <span>Kategorie</span>
          <select data-poi-filter="category">
            ${createCategoryOptions(poiData.summary.categories, filters.category)}
          </select>
        </label>

        <label class="poi-filter-field">
          <span>Naehe zur Route</span>
          <select data-poi-filter="routeProximity">
            ${createProximityOptions(filters.routeProximity)}
          </select>
        </label>

        <label class="poi-filter-field">
          <span>Highlight-Level</span>
          <select data-poi-filter="highlightLevel">
            ${createHighlightOptions(filters.highlightLevel)}
          </select>
        </label>
      </div>

      <label class="poi-filter-toggle">
        <input type="checkbox" data-poi-filter="includeNeedsEnrichment" ${filters.includeNeedsEnrichment ? "checked" : ""} />
        <span>POIs mit needs_enrichment einblenden</span>
      </label>
    </section>
  `;
}

export function createPoiListCard(visiblePois) {
  if (!visiblePois.length) {
    return `
      <section class="timeline-card">
        <h3>POI-Liste</h3>
        <p class="muted-text">Mit den aktuellen Filtern ist kein POI sichtbar.</p>
      </section>
    `;
  }

  return `
    <section class="timeline-card">
      <h3>POI-Liste</h3>
      <div class="poi-list">
        ${visiblePois.map((poi) => createPoiListItem(poi)).join("")}
      </div>
    </section>
  `;
}

export function createPoiJourneyCard(journeyGroups) {
  if (!journeyGroups.nextPrimaryPoi && !journeyGroups.currentWindow.length && !journeyGroups.upcoming.length) {
    return `
      <section class="timeline-card">
        <h3>POIs relativ zur Live-Position</h3>
        <p class="muted-text">Sobald Live-Fortschritt und sichtbare POIs zusammenkommen, erscheinen hier die naechsten Highlights entlang der Route.</p>
      </section>
    `;
  }

  const nextPoi = journeyGroups.nextPrimaryPoi
    ? `
        <article class="poi-next-card">
          <div class="poi-inline-header">
            <p class="section-intro__eyebrow">Als Naechstes</p>
            ${createPoiBreadcrumb(journeyGroups.nextPrimaryPoi)}
          </div>
          <h3>${journeyGroups.nextPrimaryPoi.name}</h3>
          <p class="poi-card__meta">Route km ~${formatKm(journeyGroups.nextPrimaryPoi.routeKm)} | ${journeyGroups.nextPrimaryPoi.relativeToLiveLabel || "noch ohne Live-Bezug"} | Score ${journeyGroups.nextPrimaryPoi.score.toFixed(3)}</p>
          <p class="poi-card__description">${journeyGroups.nextPrimaryPoi.whyItMattersForApp}</p>
        </article>
      `
    : "";

  const currentWindow = journeyGroups.currentWindow.length
    ? journeyGroups.currentWindow.map((poi) => createJourneyPoiItem(poi, "Gerade in Reichweite")).join("")
    : `<p class="muted-text">Aktuell liegt kein sichtbarer Highlight-POI direkt im Live-Fenster.</p>`;

  const upcoming = journeyGroups.upcoming.length
    ? journeyGroups.upcoming.slice(0, 3).map((poi) => createJourneyPoiItem(poi, "Weiter vorn auf der Route")).join("")
    : `<p class="muted-text">Mit den aktuellen Filtern gibt es gerade keinen weiteren kommenden POI.</p>`;

  const passed = journeyGroups.passed.length
    ? journeyGroups.passed.slice(0, 2).map((poi) => createJourneyPoiItem(poi, "Schon hinter euch")).join("")
    : "";

  return `
    <section class="timeline-card">
      <h3>POIs relativ zur Live-Position</h3>
      <div class="poi-journey-stack">
        ${nextPoi}
        <div class="poi-journey-grid">
          <section class="poi-journey-section">
            <h4>Jetzt interessant</h4>
            <div class="poi-journey-list">${currentWindow}</div>
          </section>
          <section class="poi-journey-section">
            <h4>Als Naechstes auf der Route</h4>
            <div class="poi-journey-list">${upcoming}</div>
          </section>
        </div>
        ${passed ? `<section class="poi-journey-section"><h4>Zuletzt passiert</h4><div class="poi-journey-list">${passed}</div></section>` : ""}
      </div>
    </section>
  `;
}

export function createPoiAudienceOverviewCard(audienceContext, locationData) {
  if (!audienceContext.currentLead) {
    return `
      <section class="poi-audience-card">
        <p class="section-intro__eyebrow">Zuschauerblick</p>
        <h3>Noch keine passenden Orte in Zuschauersicht</h3>
        <p class="muted-text">Sobald sichtbare POIs relativ zur Live-Position gewichtet werden koennen, erscheint hier der zentrale Reiseblick.</p>
      </section>
    `;
  }

  const lead = audienceContext.currentLead;
  const liveContextLine = locationData?.routeMatch
    ? `Aktuell bei etwa km ${locationData.routeMatch.distanceDoneKm.toFixed(0)} auf der Route`
    : "Live-Stand wird noch vorbereitet";

  return `
    <section class="poi-audience-card">
      <div class="poi-audience-card__hero">
        <div>
          <p class="section-intro__eyebrow">Zuschauerblick</p>
          <h3>${lead.name}</h3>
          <p class="poi-card__meta">${lead.viewerCategory} | ${lead.relativeToLiveLabel || "noch ohne Live-Bezug"} | ${liveContextLine}</p>
        </div>
        <span class="poi-card__score">${lead.score.toFixed(3)}</span>
      </div>
      <p class="poi-card__description">${lead.whyItMattersForApp}</p>

      <div class="poi-audience-grid">
        <section class="poi-audience-section">
          <h4>Was ist hier gerade spannend?</h4>
          <div class="poi-audience-list">
            ${audienceContext.currentArea.length ? audienceContext.currentArea.map((poi) => createCompactAudienceItem(poi)).join("") : `<p class="muted-text">Gerade eher ein ruhiger Streckenabschnitt.</p>`}
          </div>
        </section>

        <section class="poi-audience-section">
          <h4>Was kommt als Naechstes?</h4>
          <div class="poi-audience-list">
            ${audienceContext.nextInteresting.length ? audienceContext.nextInteresting.map((poi) => createCompactAudienceItem(poi)).join("") : `<p class="muted-text">Im naechsten Abschnitt ist gerade kein klarer Kandidat hinterlegt.</p>`}
          </div>
        </section>
      </div>

      <div class="poi-audience-grid">
        <section class="poi-audience-section">
          <h4>POIs der naechsten 100 km</h4>
          <div class="poi-audience-list">
            ${audienceContext.nextHundredKm.length ? audienceContext.nextHundredKm.map((poi) => createCompactAudienceItem(poi)).join("") : `<p class="muted-text">In den naechsten 100 Kilometern ist aktuell noch kein passender POI hinterlegt.</p>`}
          </div>
        </section>

        <section class="poi-audience-section">
          <h4>Welche groesseren Highlights liegen weiter vorne?</h4>
          <div class="poi-audience-list">
            ${audienceContext.macroHighlightsAhead.length ? audienceContext.macroHighlightsAhead.map((poi) => createCompactAudienceItem(poi)).join("") : `<p class="muted-text">Auf der weiteren Strecke ist aktuell kein groesseres Highlight direkt im Voraus sichtbar.</p>`}
          </div>
        </section>
      </div>
    </section>
  `;
}
