function createProgressBar(progressPercent) {
  return `
    <div class="route-progress">
      <div class="route-progress__bar">
        <span style="width: ${progressPercent}"></span>
      </div>
    </div>
  `;
}

function getActiveProgress(routeData, locationData) {
  if (locationData?.routeMatch) {
    return {
      progressRatio: locationData.routeMatch.progressRatio,
      distanceDoneKm: locationData.routeMatch.distanceDoneKm,
      percentLabel: locationData.routeMatch.percentLabel,
      distanceDoneLabel: locationData.routeMatch.distanceDoneLabel,
      remainingLabel: locationData.routeMatch.remainingLabel,
      progressLabel: `Live via ${locationData.providerLabel}`,
      progressStory: locationData.note,
      currentPoint: locationData.routeMatch.point,
      currentLocationLabel: locationData.routeMatch.coordinateLabel,
    };
  }

  return routeData.currentProgress;
}

function getLast24HoursLabel(routeData, activeProgress) {
  const currentPoint = activeProgress.currentPoint;

  if (!currentPoint?.time || typeof currentPoint.cumulativeDistanceMeters !== "number") {
    return "k. A.";
  }

  const currentTimestamp = new Date(currentPoint.time).getTime();

  if (Number.isNaN(currentTimestamp)) {
    return "k. A.";
  }

  const threshold = currentTimestamp - 24 * 60 * 60 * 1000;
  let candidatePoint = null;

  for (const point of routeData.points) {
    if (!point.time) {
      continue;
    }

    const pointTimestamp = new Date(point.time).getTime();

    if (Number.isNaN(pointTimestamp)) {
      continue;
    }

    if (pointTimestamp <= threshold) {
      candidatePoint = point;
    } else {
      break;
    }
  }

  if (!candidatePoint || typeof candidatePoint.cumulativeDistanceMeters !== "number") {
    return "k. A.";
  }

  const distanceKm = Math.max(
    0,
    (currentPoint.cumulativeDistanceMeters - candidatePoint.cumulativeDistanceMeters) / 1000,
  );

  return `${distanceKm.toFixed(0)} km`;
}

const TILE_SIZE = 256;
const BASEMAP_STYLE = "rastertiles/voyager_nolabels";
const BASEMAP_ATTRIBUTION = "Kartendaten © OpenStreetMap-Mitwirkende, Basemap © CARTO";

function clampLatitude(latitude) {
  return Math.max(-85.05112878, Math.min(85.05112878, latitude));
}

function lonToWorldX(longitude, zoom) {
  const scale = TILE_SIZE * 2 ** zoom;
  return ((longitude + 180) / 360) * scale;
}

function latToWorldY(latitude, zoom) {
  const scale = TILE_SIZE * 2 ** zoom;
  const clampedLatitude = clampLatitude(latitude);
  const radians = (clampedLatitude * Math.PI) / 180;
  const mercator = Math.log(Math.tan(Math.PI / 4 + radians / 2));

  return (scale * (Math.PI - mercator)) / (2 * Math.PI);
}

function createExpandedBounds(bounds, factor = 0.08) {
  const latSpan = Math.max(bounds.maxLat - bounds.minLat, 0.1);
  const lonSpan = Math.max(bounds.maxLon - bounds.minLon, 0.1);

  return {
    minLat: clampLatitude(bounds.minLat - latSpan * factor),
    maxLat: clampLatitude(bounds.maxLat + latSpan * factor),
    minLon: Math.max(-180, bounds.minLon - lonSpan * factor),
    maxLon: Math.min(180, bounds.maxLon + lonSpan * factor),
  };
}

function chooseBasemapZoom(bounds) {
  for (let zoom = 6; zoom >= 2; zoom -= 1) {
    const minTileX = Math.floor(lonToWorldX(bounds.minLon, zoom) / TILE_SIZE);
    const maxTileX = Math.floor(lonToWorldX(bounds.maxLon, zoom) / TILE_SIZE);
    const minTileY = Math.floor(latToWorldY(bounds.maxLat, zoom) / TILE_SIZE);
    const maxTileY = Math.floor(latToWorldY(bounds.minLat, zoom) / TILE_SIZE);
    const tileCount = (maxTileX - minTileX + 1) * (maxTileY - minTileY + 1);

    if (tileCount <= 12) {
      return zoom;
    }
  }

  return 2;
}

function createProjection(routeData, width, height, padding) {
  const expandedBounds = createExpandedBounds(routeData.bounds);
  const zoom = chooseBasemapZoom(expandedBounds);
  const minRouteWorldX = lonToWorldX(expandedBounds.minLon, zoom);
  const maxRouteWorldX = lonToWorldX(expandedBounds.maxLon, zoom);
  const minRouteWorldY = latToWorldY(expandedBounds.maxLat, zoom);
  const maxRouteWorldY = latToWorldY(expandedBounds.minLat, zoom);
  const minTileX = Math.floor(lonToWorldX(expandedBounds.minLon, zoom) / TILE_SIZE);
  const maxTileX = Math.floor(lonToWorldX(expandedBounds.maxLon, zoom) / TILE_SIZE);
  const minTileY = Math.floor(latToWorldY(expandedBounds.maxLat, zoom) / TILE_SIZE);
  const maxTileY = Math.floor(latToWorldY(expandedBounds.minLat, zoom) / TILE_SIZE);
  const worldWidth = Math.max(maxRouteWorldX - minRouteWorldX, 1);
  const worldHeight = Math.max(maxRouteWorldY - minRouteWorldY, 1);
  const drawableWidth = width - padding * 2;
  const drawableHeight = height - padding * 2;
  const scale = Math.min(drawableWidth / worldWidth, drawableHeight / worldHeight);
  const offsetX = padding + (drawableWidth - worldWidth * scale) / 2;
  const offsetY = padding + (drawableHeight - worldHeight * scale) / 2;

  return {
    zoom,
    tileRange: { minTileX, maxTileX, minTileY, maxTileY },
    worldBounds: {
      minWorldX: minRouteWorldX,
      maxWorldX: maxRouteWorldX,
      minWorldY: minRouteWorldY,
      maxWorldY: maxRouteWorldY,
    },
    scale,
    offsetX,
    offsetY,
  };
}

function projectCoordinate(point, projection) {
  const worldX = lonToWorldX(point.lon, projection.zoom);
  const worldY = latToWorldY(point.lat, projection.zoom);

  return {
    x: projection.offsetX + (worldX - projection.worldBounds.minWorldX) * projection.scale,
    y: projection.offsetY + (worldY - projection.worldBounds.minWorldY) * projection.scale,
  };
}

function createProjectedPolyline(points, projection) {
  return points
    .map((point) => {
      const projected = projectCoordinate(point, projection);
      return `${projected.x.toFixed(1)},${projected.y.toFixed(1)}`;
    })
    .join(" ");
}

function createBasemapTileUrl(tileX, tileY, zoom) {
  const subdomains = ["a", "b", "c", "d"];
  const subdomain = subdomains[Math.abs(tileX + tileY) % subdomains.length];

  return `https://${subdomain}.basemaps.cartocdn.com/${BASEMAP_STYLE}/${zoom}/${tileX}/${tileY}.png`;
}

function createBasemapImages(projection) {
  const images = [];

  for (let tileX = projection.tileRange.minTileX; tileX <= projection.tileRange.maxTileX; tileX += 1) {
    for (let tileY = projection.tileRange.minTileY; tileY <= projection.tileRange.maxTileY; tileY += 1) {
      const x = projection.offsetX + (tileX * TILE_SIZE - projection.worldBounds.minWorldX) * projection.scale;
      const y = projection.offsetY + (tileY * TILE_SIZE - projection.worldBounds.minWorldY) * projection.scale;
      const size = TILE_SIZE * projection.scale;

      images.push(`
        <image
          href="${createBasemapTileUrl(tileX, tileY, projection.zoom)}"
          x="${x.toFixed(1)}"
          y="${y.toFixed(1)}"
          width="${size.toFixed(1)}"
          height="${size.toFixed(1)}"
          preserveAspectRatio="none"
          class="route-map-svg__tile"
        />
      `);
    }
  }

  return images.join("");
}

function createRouteSvgMarkup(routeData, currentPoint, poiMarkers = [], variant = "detail") {
  const width = 760;
  const height = variant === "dashboard" ? 210 : variant === "hero" ? 320 : 420;
  const padding = 28;
  const projection = createProjection(routeData, width, height, padding);
  const currentProjected = projectCoordinate(currentPoint, projection);
  const routePolyline = createProjectedPolyline(routeData.sampledRoute, projection);
  const clipId = `routeMapClip-${variant}`;

  return `
    <svg viewBox="0 0 ${width} ${height}" class="route-map-svg" role="img" aria-label="Routenverlauf">
      <defs>
        <linearGradient id="routeLineGradient" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stop-color="#eb8f34" />
          <stop offset="100%" stop-color="#0c6b58" />
        </linearGradient>
        <clipPath id="${clipId}">
          <rect x="0" y="0" width="${width}" height="${height}" rx="28"></rect>
        </clipPath>
      </defs>
      <rect x="0" y="0" width="${width}" height="${height}" rx="28" class="route-map-svg__bg"></rect>
      <g clip-path="url(#${clipId})">
        ${createBasemapImages(projection)}
        <rect x="0" y="0" width="${width}" height="${height}" rx="28" class="route-map-svg__veil"></rect>
        <polyline points="${routePolyline}" class="route-map-svg__line"></polyline>
        ${createPoiMarkers(routeData, poiMarkers, height)}
        <circle cx="${currentProjected.x.toFixed(1)}" cy="${currentProjected.y.toFixed(1)}" r="11" class="route-map-svg__current"></circle>
      </g>
    </svg>
  `;
}

export function createRouteDashboardMapTile(routeData, locationData) {
  const activeProgress = getActiveProgress(routeData, locationData);

  return `
    <div class="dashboard-focus-card dashboard-focus-card--route-map">
      <div class="dashboard-focus-card__header">
        <div>
          <p class="section-intro__eyebrow">Live-Karte</p>
          <h3>Wo sind sie gerade?</h3>
        </div>
      </div>
      <div id="live-map-placeholder" class="live-map-el"></div>
    </div>
  `;
}

export function createRouteDashboardStatsTile(routeData, locationData, dailyStats = {}) {
  const activeProgress = getActiveProgress(routeData, locationData);
  const progressPct = Math.round((activeProgress.progressRatio ?? 0) * 100);

  const fmtKm = (km) => (km != null ? `${km.toFixed(0)} km` : "–");

  return `
    <a class="dashboard-focus-card dashboard-focus-card--route-stats" href="#route">
      <div class="dashboard-focus-card__header">
        <div>
          <p class="section-intro__eyebrow">Favorit</p>
          <h3>Tourstatus</h3>
        </div>
        <span class="tag tag--accent">${progressPct} %</span>
      </div>

      <div class="stats-progress">
        <div class="stats-progress__bar">
          <div class="stats-progress__fill" style="width:${progressPct}%"></div>
        </div>
        <div class="stats-progress__labels">
          <div>
            <strong>${activeProgress.distanceDoneLabel}</strong>
            <span>geschafft</span>
          </div>
          <div class="stats-progress__total">
            <strong>${routeData.totalDistanceLabel}</strong>
            <span>gesamt</span>
          </div>
          <div>
            <strong>${activeProgress.remainingLabel}</strong>
            <span>verbleibend</span>
          </div>
        </div>
      </div>

      <div class="stats-daily">
        <div class="stats-daily__item">
          <span>Heute</span>
          <strong>${fmtKm(dailyStats.todayKm)}</strong>
        </div>
        <div class="stats-daily__item">
          <span>Gestern</span>
          <strong class="stats-daily__item--muted">${fmtKm(dailyStats.yesterdayKm)}</strong>
        </div>
      </div>
    </a>
  `;
}

export function createRouteHero(routeData, locationData) {
  const activeProgress = getActiveProgress(routeData, locationData);

  return `
    <section class="route-hero-card">
      <div class="route-hero-card__copy">
        <p class="section-intro__eyebrow">Herzstueck der App</p>
        <h2>${routeData.name}</h2>
        <p class="route-hero-card__lead">
          Die GPX-Route ist jetzt die gemeinsame Erzaehlachse der App: Distanz, Fortschritt, Profil und spaetere Updates koennen sich direkt daran aufhaengen.
        </p>

        <div class="route-hero-card__metrics">
          <article>
            <span>Gesamtdistanz</span>
            <strong>${routeData.totalDistanceLabel}</strong>
          </article>
          <article>
            <span>Bisher geschafft</span>
            <strong>${activeProgress.distanceDoneLabel}</strong>
          </article>
          <article>
            <span>Verbleibend</span>
            <strong>${activeProgress.remainingLabel}</strong>
          </article>
        </div>

        <div class="route-progress-block">
          <div class="route-progress-block__label">
            <span>${activeProgress.progressLabel}</span>
            <strong>${activeProgress.percentLabel}</strong>
          </div>
          ${createProgressBar(activeProgress.percentLabel)}
          <p class="muted-text">${activeProgress.progressStory}</p>
        </div>
      </div>

      <div class="route-visual-stack">
        ${createRouteMapFigure(routeData, locationData, [], "hero")}
        ${createElevationFigure(routeData)}
      </div>
    </section>
  `;
}

function createPoiMarkers(routeData, pois, height) {
  if (!pois?.length) {
    return "";
  }

  const width = 760;
  const padding = 28;
  const projection = createProjection(routeData, width, height, padding);

  return pois
    .filter((poi) => typeof poi.latitude === "number" && typeof poi.longitude === "number")
    .map((poi) => {
      const projected = projectCoordinate({ lat: poi.latitude, lon: poi.longitude }, projection);
      const markerClass =
        poi.highlightLevel === "world_class" || poi.highlightLevel === "top_highlight"
          ? "route-map-svg__poi route-map-svg__poi--top"
          : poi.highlightLevel === "strong_candidate"
            ? "route-map-svg__poi route-map-svg__poi--strong"
            : "route-map-svg__poi route-map-svg__poi--context";

      return `<circle cx="${projected.x.toFixed(1)}" cy="${projected.y.toFixed(1)}" r="6.5" class="${markerClass}">
        <title>${poi.name} (${poi.score.toFixed(3)})</title>
      </circle>`;
    })
    .join("");
}

export function createRouteMapFigure(routeData, locationData, poiMarkers = [], variant = "detail") {
  const activeProgress = getActiveProgress(routeData, locationData);

  return `
    <article class="route-visual-card route-visual-card--${variant}">
      <div class="route-visual-card__header">
        <div>
          <p class="section-intro__eyebrow">Route als Bild</p>
          <h3>Vom Start bis zum Ziel in einer Linie</h3>
        </div>
        <span class="tag tag--accent">${routeData.pointsCount.toLocaleString("de-DE")} Trackpunkte</span>
      </div>
      ${createRouteSvgMarkup(routeData, activeProgress.currentPoint, poiMarkers, variant)}
      <div class="route-visual-card__footer">
        <p><strong>Start:</strong> ${routeData.startLabel}</p>
        <p><strong>Aktueller Punkt:</strong> ${activeProgress.currentLocationLabel}</p>
        <p><strong>Ziel:</strong> ${routeData.endLabel}</p>
      </div>
      <p class="route-visual-card__attribution">${BASEMAP_ATTRIBUTION}</p>
    </article>
  `;
}

export function createElevationFigure(routeData) {
  return `
    <article class="route-visual-card route-visual-card--profile">
      <div class="route-visual-card__header">
        <div>
          <p class="section-intro__eyebrow">Hoehenprofil</p>
          <h3>Wie sich die Tour auf und ab bewegt</h3>
        </div>
        <span class="tag tag--success">${routeData.elevationGainLabel}</span>
      </div>
      <svg viewBox="0 0 760 220" class="route-profile-svg" role="img" aria-label="Hoehenprofil">
        <rect x="0" y="0" width="760" height="220" rx="28" class="route-profile-svg__bg"></rect>
        <path d="${routeData.profileSvgPath}" class="route-profile-svg__line"></path>
      </svg>
      <div class="route-visual-card__footer">
        <p><strong>Hoehenspanne:</strong> ${routeData.elevationSpanLabel}</p>
        <p><strong>Abstieg gesamt:</strong> ${routeData.elevationLossLabel}</p>
        <p><strong>GPX-Zeitspanne:</strong> ${routeData.journeySpanLabel}</p>
      </div>
    </article>
  `;
}

export function createRouteMetricGrid(routeData, locationData) {
  const activeProgress = getActiveProgress(routeData, locationData);
  const metrics = [
    { label: "Gesamtdistanz", value: routeData.totalDistanceLabel },
    { label: "Aufstieg", value: routeData.elevationGainLabel },
    { label: "Abstieg", value: routeData.elevationLossLabel },
    { label: "Hoechster Punkt", value: `${Math.round(routeData.maxElevation)} m` },
    { label: "Niedrigster Punkt", value: `${Math.round(routeData.minElevation)} m` },
    { label: "Trackpunkte", value: routeData.pointsCount.toLocaleString("de-DE") },
    { label: "Fortschritt", value: activeProgress.percentLabel },
    { label: "Restdistanz", value: activeProgress.remainingLabel },
  ];

  return `
    <section class="stats-grid">
      ${metrics
        .map(
          (metric) => `
            <article class="stat-card stat-card--calm">
              <p>${metric.label}</p>
              <h3>${metric.value}</h3>
            </article>
          `,
        )
        .join("")}
    </section>
  `;
}

export function createRouteMilestones(routeData) {
  return `
    <section class="timeline-card">
      <h3>Interpretation der Tourachse</h3>
      <div class="route-milestones">
        ${routeData.milestones
          .map(
            (milestone) => `
              <article class="route-milestone ${milestone.isReached ? "is-reached" : ""}">
                <div class="route-milestone__dot"></div>
                <div>
                  <p class="route-milestone__label">${milestone.label}</p>
                  <h4>${milestone.distanceLabel}</h4>
                  <p class="muted-text">${milestone.coordinateLabel}</p>
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

export function createRouteLoadingCard(message) {
  return `
    <section class="route-loading-card">
      <p class="section-intro__eyebrow">Route laedt</p>
      <h2>${message}</h2>
      <p class="muted-text">Die GPX-Datei wird eingelesen und in Distanz-, Profil- und Fortschrittsdaten umgewandelt.</p>
    </section>
  `;
}

export function createLocationProviderCard(locationData, locationState = {}) {
  if (locationState.locationLoading) {
    return `
      <section class="timeline-card">
        <h3>LocationProvider</h3>
        <p class="muted-text">Live-Position wird geladen.</p>
      </section>
    `;
  }

  if (!locationData) {
    return `
      <section class="timeline-card">
        <h3>LocationProvider</h3>
        <p class="muted-text">${locationState.locationError || "Noch keine Live-Position verfuegbar."}</p>
      </section>
    `;
  }

  return `
    <section class="timeline-card">
      <h3>LocationProvider</h3>
      <div class="provider-grid">
        <article class="info-card">
          <p class="info-card__title">${locationData.providerLabel}</p>
          <h3>${locationData.deviceName}</h3>
          <p class="info-card__detail">${locationData.note}</p>
        </article>
        <article class="info-card">
          <p class="info-card__title">Letztes Signal</p>
          <h3>${locationData.routeMatch.lastUpdateLabel}</h3>
          <p class="info-card__detail">${locationData.routeMatch.routeStatusLabel}</p>
        </article>
        <article class="info-card">
          <p class="info-card__title">Live-Fortschritt</p>
          <h3>${locationData.routeMatch.percentLabel}</h3>
          <p class="info-card__detail">${locationData.routeMatch.distanceDoneLabel} geschafft, ${locationData.routeMatch.remainingLabel} offen</p>
        </article>
        <article class="info-card">
          <p class="info-card__title">Positionsdaten</p>
          <h3>${locationData.routeMatch.coordinateLabel}</h3>
          <p class="info-card__detail">Tempo ${Math.round(locationData.speedKph || 0)} km/h, Akku ${locationData.batteryLevel ?? "?"}%</p>
        </article>
      </div>
    </section>
  `;
}

export function createLocationDashboardTile(locationData, locationState = {}) {
  if (locationState.locationLoading) {
    return `
      <a class="dashboard-sandbox-card" href="#status">
        <p class="section-intro__eyebrow">Sandbox</p>
        <h3>Live-Status</h3>
        <p class="muted-text">Live-Position wird geladen.</p>
      </a>
    `;
  }

  if (!locationData) {
    return `
      <a class="dashboard-sandbox-card" href="#status">
        <p class="section-intro__eyebrow">Sandbox</p>
        <h3>Live-Status</h3>
        <p class="muted-text">${locationState.locationError || "Noch keine Live-Position verfuegbar."}</p>
      </a>
    `;
  }

  return `
    <a class="dashboard-sandbox-card" href="#status">
      <p class="section-intro__eyebrow">Sandbox</p>
      <h3>Live-Status</h3>
      <p class="dashboard-sandbox-card__value">${locationData.routeMatch.routeStatusLabel}</p>
      <p class="dashboard-sandbox-card__meta">${locationData.providerLabel} | ${locationData.routeMatch.lastUpdateLabel}</p>
      <p class="muted-text">${locationData.routeMatch.coordinateLabel}</p>
    </a>
  `;
}

export function createPhotoRouteSvg(routeData, locationData, photos) {
  const width = 760;
  const height = 320;
  const padding = 28;
  const projection = createProjection(routeData, width, height, padding);
  const activeProgress = getActiveProgress(routeData, locationData);
  const currentPoint = activeProgress.currentPoint;
  const routePolyline = createProjectedPolyline(routeData.sampledRoute, projection);
  const clipId = 'routeMapClip-photos';

  let currentMarker = '';
  if (currentPoint) {
    const cur = projectCoordinate(currentPoint, projection);
    currentMarker = `<circle cx="${cur.x.toFixed(1)}" cy="${cur.y.toFixed(1)}" r="11" class="route-map-svg__current"></circle>`;
  }

  const photoDots = photos
    .filter((p) => p.lat != null && p.lon != null)
    .map((photo, index) => {
      let nearestPoint = routeData.sampledRoute[0];
      let minDist = Infinity;
      for (const pt of routeData.sampledRoute) {
        const d = (pt.lat - photo.lat) ** 2 + (pt.lon - photo.lon) ** 2;
        if (d < minDist) {
          minDist = d;
          nearestPoint = pt;
        }
      }
      const { x, y } = projectCoordinate(nearestPoint, projection);
      const caption = photo.date ? new Date(photo.date).toLocaleDateString('de-DE') : '';
      return `
        <circle
          cx="${x.toFixed(1)}"
          cy="${y.toFixed(1)}"
          r="8"
          class="route-map-svg__photo-dot"
          data-lightbox-src="${photo.url}"
          data-lightbox-caption="${caption}"
          data-photo-index="${index}"
          style="cursor:pointer"
        >
          <title>${photo.filename}${caption ? ' · ' + caption : ''}</title>
        </circle>
      `;
    })
    .join('');

  return `
    <div class="gallery-route-view">
      <p class="muted-text" style="margin-bottom:8px">Klick auf einen Punkt zeigt das Foto</p>
      <svg viewBox="0 0 ${width} ${height}" class="route-map-svg" role="img" aria-label="Routenverlauf mit Fotos">
        <defs>
          <clipPath id="${clipId}">
            <rect x="0" y="0" width="${width}" height="${height}" rx="28"></rect>
          </clipPath>
        </defs>
        <rect x="0" y="0" width="${width}" height="${height}" rx="28" class="route-map-svg__bg"></rect>
        <g clip-path="url(#${clipId})">
          ${createBasemapImages(projection)}
          <rect x="0" y="0" width="${width}" height="${height}" rx="28" class="route-map-svg__veil"></rect>
          <polyline points="${routePolyline}" class="route-map-svg__line"></polyline>
          ${currentMarker}
          ${photoDots}
        </g>
      </svg>
    </div>
  `;
}
