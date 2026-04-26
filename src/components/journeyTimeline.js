export function createJourneyTimelineCard(routeData, locationData, countrySegments) {
  if (!countrySegments?.length || !routeData) return "";

  const progressRatio = locationData?.routeMatch?.progressRatio ?? routeData.currentProgress.ratio ?? 0;
  const pct = +(progressRatio * 100).toFixed(2);

  // Identify which segment is current and which is next
  let currentIdx = countrySegments.length - 1;
  for (let i = 0; i < countrySegments.length; i++) {
    if (progressRatio < countrySegments[i].toPercent) {
      currentIdx = i;
      break;
    }
  }
  const nextIdx = currentIdx + 1 < countrySegments.length ? currentIdx + 1 : -1;

  // Flag slots — centered over each country's distance band
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

  // Subtle country-color tint bands underneath the progress fill
  const bands = countrySegments
    .map((seg) => {
      const left = +(seg.fromPercent * 100).toFixed(2);
      const width = +((seg.toPercent - seg.fromPercent) * 100).toFixed(2);
      return `<div class="jt-band" style="left:${left}%;width:${width}%;background:${seg.color}"></div>`;
    })
    .join("");

  // Border dividers between countries — next border is highlighted
  const borderMarks = countrySegments
    .slice(1)
    .map((seg, i) => {
      const isNext = nextIdx !== -1 && i + 1 === nextIdx;
      const left = +(seg.fromPercent * 100).toFixed(2);
      return `<div class="jt-border-mark${isNext ? " jt-border-mark--next" : ""}" style="left:${left}%"></div>`;
    })
    .join("");

  return `
    <article class="journey-timeline-card">
      <div class="jt-track">
        <div class="jt-flags">${flagSlots}</div>
        <div class="jt-bar-wrapper">
          <div class="jt-bar">
            ${bands}
            <div class="jt-bar__fill" style="width:${pct}%"></div>
          </div>
          ${borderMarks}
          <div class="jt-marker" style="left:${pct}%">
            <div class="jt-marker__pulse"></div>
            <div class="jt-marker__dot"></div>
          </div>
        </div>
      </div>
    </article>
  `;
}
