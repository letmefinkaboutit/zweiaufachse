export function createJourneyTimelineCard(routeData, locationData, countrySegments) {
  if (!countrySegments?.length || !routeData) return "";

  const progressRatio = locationData?.routeMatch?.progressRatio ?? routeData.currentProgress.ratio ?? 0;

  let currentIdx = countrySegments.length - 1;
  for (let i = 0; i < countrySegments.length; i++) {
    if (progressRatio < countrySegments[i].toPercent) {
      currentIdx = i;
      break;
    }
  }
  const nextIdx = currentIdx + 1 < countrySegments.length ? currentIdx + 1 : -1;

  const flagSlots = countrySegments
    .map((seg, i) => {
      const left = +(seg.fromPercent * 100).toFixed(2);
      const width = +((seg.toPercent - seg.fromPercent) * 100).toFixed(2);
      const cls =
        i === currentIdx
          ? " jt-flag-slot--active"
          : i === nextIdx
            ? " jt-flag-slot--next"
            : i < currentIdx
              ? " jt-flag-slot--passed"
              : " jt-flag-slot--future";
      return `<div class="jt-flag-slot${cls}" style="left:${left}%;width:${width}%">${seg.flag}</div>`;
    })
    .join("");

  // SVG elevation profile
  const VW = 1000;
  const VH = 80;
  const ELEV_TOP = 4;
  const ELEV_BOTTOM = 72;
  const ELEV_H = ELEV_BOTTOM - ELEV_TOP;
  const totalDistanceM = routeData.totalDistanceKm * 1000;
  const eleSpan = Math.max(routeData.maxElevation - routeData.minElevation, 1);
  const progressX = +(progressRatio * VW).toFixed(1);

  const pts = routeData.sampledRoute.map((p) => ({
    x: +((p.cumulativeDistanceMeters / totalDistanceM) * VW).toFixed(1),
    y: +(ELEV_BOTTOM - ((p.ele - routeData.minElevation) / eleSpan) * ELEV_H).toFixed(1),
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const fillPath = `${linePath} L${VW},${ELEV_BOTTOM} L0,${ELEV_BOTTOM} Z`;

  const progIdx = Math.min(pts.length - 1, Math.round(progressRatio * (pts.length - 1)));
  const markerY = pts[progIdx].y;

  const countryBands = countrySegments
    .map((seg) => {
      const x = +((seg.fromPercent * VW)).toFixed(1);
      const w = +(((seg.toPercent - seg.fromPercent) * VW)).toFixed(1);
      return `<rect x="${x}" y="${ELEV_BOTTOM}" width="${w}" height="${VH - ELEV_BOTTOM}" fill="${seg.color}" opacity="0.55"/>`;
    })
    .join("");

  const borderLines = countrySegments
    .slice(1)
    .map((seg, i) => {
      const isNext = nextIdx !== -1 && i + 1 === nextIdx;
      const x = +((seg.fromPercent * VW)).toFixed(1);
      return `<line x1="${x}" y1="${ELEV_TOP}" x2="${x}" y2="${ELEV_BOTTOM}" stroke="${isNext ? "rgba(235,143,52,0.6)" : "rgba(31,42,47,0.12)"}" stroke-width="${isNext ? 2 : 1}"/>`;
    })
    .join("");

  return `
    <article class="journey-timeline-card">
      <span class="jt-progress-pct">${Math.round(progressRatio * 100)} %</span>
      <div class="jt-track">
        <div class="jt-flags">${flagSlots}</div>
        <svg class="jt-profile-svg" viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <clipPath id="jt-done-clip">
              <rect x="0" y="0" width="${progressX}" height="${VH}"/>
            </clipPath>
          </defs>
          ${countryBands}
          <path d="${fillPath}" fill="rgba(31,42,47,0.05)"/>
          <path d="${linePath}" fill="none" stroke="rgba(31,42,47,0.18)" stroke-width="1.5" stroke-linejoin="round"/>
          <path d="${fillPath}" fill="rgba(235,143,52,0.22)" clip-path="url(#jt-done-clip)"/>
          <path d="${linePath}" fill="none" stroke="rgba(235,143,52,0.85)" stroke-width="2" stroke-linejoin="round" clip-path="url(#jt-done-clip)"/>
          ${borderLines}
          <line x1="${progressX}" y1="${markerY}" x2="${progressX}" y2="${ELEV_BOTTOM}" stroke="rgba(235,143,52,0.5)" stroke-width="1.5"/>
          <circle class="jt-svg-pulse" cx="${progressX}" cy="${markerY}" r="7" fill="rgba(235,143,52,0.22)"/>
          <circle cx="${progressX}" cy="${markerY}" r="3.5" fill="rgb(235,143,52)" stroke="white" stroke-width="2"/>
        </svg>
      </div>
    </article>
  `;
}
