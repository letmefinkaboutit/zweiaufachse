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

function createPoiListItem(poi) {
  return `
    <article class="poi-card">
      <div class="poi-card__header">
        <div>
          <p class="poi-card__eyebrow">${poi.country} | ${poi.viewerCategory}</p>
          <h3>${poi.name}</h3>
        </div>
        <span class="poi-card__score">${poi.score.toFixed(3)}</span>
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
      <p class="poi-card__eyebrow">${label}</p>
      <h4>${poi.name}</h4>
      <p class="poi-card__meta">Route km ~${formatKm(poi.routeKm)} | ${poi.relativeToLiveLabel || "noch ohne Live-Bezug"} | ${poi.viewerCategory}</p>
      <p class="poi-card__description">${poi.shortDescription}</p>
    </article>
  `;
}

function createCompactAudienceItem(poi) {
  return `
    <article class="poi-audience-item">
      <p class="poi-card__eyebrow">${poi.viewerCategory}</p>
      <h4>${poi.name}</h4>
      <p class="poi-card__meta">${poi.relativeToLiveLabel || "noch ohne Live-Bezug"} | Route km ~${formatKm(poi.routeKm)}</p>
    </article>
  `;
}

function createMiniAudienceItem(poi) {
  return `
    <article class="dashboard-poi-item">
      <p class="poi-card__eyebrow">${poi.viewerCategory}</p>
      <h4>${poi.name}</h4>
      <p class="poi-card__meta">${poi.relativeToLiveLabel || "noch ohne Live-Bezug"}</p>
    </article>
  `;
}

export function createCurrentAudienceTile(audienceContext) {
  const items = audienceContext?.currentArea || [];
  const lead = items[0] || audienceContext?.currentLead || null;

  return `
    <a class="dashboard-focus-card" href="#route">
      <div class="dashboard-focus-card__header">
        <div>
          <p class="section-intro__eyebrow">Favorit</p>
          <h3>Was ist hier gerade spannend?</h3>
        </div>
      </div>
      ${
        lead
          ? `
            <div class="dashboard-focus-card__lead">
              <p class="poi-card__eyebrow">${lead.viewerCategory}</p>
              <h4>${lead.name}</h4>
              <p class="poi-card__description">${lead.whyItMattersForApp}</p>
            </div>
          `
          : `<p class="muted-text">Gerade ist es eher ein ruhiger Abschnitt. Auf der Routenseite sind trotzdem alle sichtbaren Punkte im Detail verfuegbar.</p>`
      }
      <div class="dashboard-poi-list">
        ${items.length ? items.slice(0, 3).map((poi) => createMiniAudienceItem(poi)).join("") : `<p class="muted-text">Aktuell liegen keine weiteren starken Punkte direkt im Live-Fenster.</p>`}
      </div>
    </a>
  `;
}

export function createForwardAudienceTile(audienceContext) {
  const nextWindow = audienceContext?.nextHundredKm || [];
  const macro = audienceContext?.macroHighlightsAhead || [];

  return `
    <a class="dashboard-focus-card" href="#route">
      <div class="dashboard-focus-card__header">
        <div>
          <p class="section-intro__eyebrow">Favorit</p>
          <h3>Was kommt als Naechstes?</h3>
        </div>
      </div>
      <section class="dashboard-focus-card__section">
        <h4>POIs der naechsten 100 km</h4>
        <div class="dashboard-poi-list">
          ${nextWindow.length ? nextWindow.slice(0, 3).map((poi) => createMiniAudienceItem(poi)).join("") : `<p class="muted-text">Im naechsten Abschnitt sind aktuell noch keine passenden POIs hinterlegt.</p>`}
        </div>
      </section>
      <section class="dashboard-focus-card__section">
        <h4>Groessere Highlights weiter vorn</h4>
        <div class="dashboard-poi-list">
          ${macro.length ? macro.slice(0, 3).map((poi) => createMiniAudienceItem(poi)).join("") : `<p class="muted-text">Weiter vorne ist gerade kein groesseres Highlight sichtbar.</p>`}
        </div>
      </section>
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
          <p class="section-intro__eyebrow">Als Naechstes</p>
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
