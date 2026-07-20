export const COUNTRY_NAMES = {
  DE: "Deutschland", AT: "Österreich", IT: "Italien",
  SI: "Slowenien", HR: "Kroatien", BA: "Bosnien & Herzegowina",
  ME: "Montenegro", AL: "Albanien", MK: "Nordmazedonien", GR: "Griechenland",
};

// Flagge und Farbe pro Land — unabhaengig davon, woher die Grenzen kommen.
const COUNTRY_META = {
  DE: { flag: "🇩🇪", color: "#1a1a1a" },
  AT: { flag: "🇦🇹", color: "#ED2939" },
  IT: { flag: "🇮🇹", color: "#009246" },
  SI: { flag: "🇸🇮", color: "#003DA5" },
  HR: { flag: "🇭🇷", color: "#FF0000" },
  BA: { flag: "🇧🇦", color: "#002395" },
  ME: { flag: "🇲🇪", color: "#D4AF37" },
  AL: { flag: "🇦🇱", color: "#E41E20" },
  MK: { flag: "🇲🇰", color: "#CE2028" },
  GR: { flag: "🇬🇷", color: "#0D5EAF" },
  RS: { flag: "🇷🇸", color: "#C6363C" },
  XK: { flag: "🇽🇰", color: "#244AA5" },
  HU: { flag: "🇭🇺", color: "#436F4D" },
  CH: { flag: "🇨🇭", color: "#D52B1E" },
};

// Bounding boxes ordered by expected route traversal.
// When a point matches multiple boxes, the smallest-area box wins (most specific country).
//
// ACHTUNG: Nur noch Notnagel. Rechtecke koennen echte Grenzverlaeufe nicht
// abbilden — die DE- und die AT-Box ueberlappen sich ueber halb Oberbayern,
// und weil die kleinere gewinnt, galt dort alles suedlich von 47.8 N als
// Oesterreich (Uebertritt rund 75 km zu frueh). Der reale Verlauf kommt aus
// src/route/country-crossings.json, gebaut von tools/build-country-crossings.mjs.
const COUNTRY_BOXES = [
  { code: "DE", flag: "🇩🇪", color: "#1a1a1a", minLat: 47.3, maxLat: 55.1, minLon:  5.9, maxLon: 15.2 },
  { code: "AT", flag: "🇦🇹", color: "#ED2939", minLat: 46.4, maxLat: 47.8, minLon:  9.5, maxLon: 17.2 },
  { code: "IT", flag: "🇮🇹", color: "#009246", minLat: 45.5, maxLat: 47.1, minLon:  6.6, maxLon: 12.5 },
  { code: "SI", flag: "🇸🇮", color: "#003DA5", minLat: 45.4, maxLat: 46.9, minLon: 13.3, maxLon: 16.7 },
  { code: "HR", flag: "🇭🇷", color: "#FF0000", minLat: 42.4, maxLat: 46.6, minLon: 13.5, maxLon: 19.4 },
  { code: "BA", flag: "🇧🇦", color: "#002395", minLat: 42.6, maxLat: 45.3, minLon: 15.7, maxLon: 19.7 },
  { code: "ME", flag: "🇲🇪", color: "#D4AF37", minLat: 41.9, maxLat: 43.6, minLon: 18.4, maxLon: 20.4 },
  { code: "AL", flag: "🇦🇱", color: "#E41E20", minLat: 39.6, maxLat: 42.7, minLon: 19.3, maxLon: 21.1 },
  { code: "MK", flag: "🇲🇰", color: "#CE2028", minLat: 40.9, maxLat: 42.4, minLon: 20.5, maxLon: 23.0 },
  { code: "GR", flag: "🇬🇷", color: "#0D5EAF", minLat: 34.8, maxLat: 42.0, minLon: 19.4, maxLon: 29.7 },
];

function detectRaw(lat, lon) {
  let best = null;
  let bestArea = Infinity;

  for (const box of COUNTRY_BOXES) {
    if (lat >= box.minLat && lat <= box.maxLat && lon >= box.minLon && lon <= box.maxLon) {
      const area = (box.maxLat - box.minLat) * (box.maxLon - box.minLon);
      if (area < bestArea) {
        bestArea = area;
        best = box.code;
      }
    }
  }

  return best;
}

export function buildCountrySegments(routeData) {
  const points = routeData.sampledRoute;
  const n = points.length;
  const totalDistanceM = routeData.totalDistanceKm * 1000;

  // Raw country code per sampled point
  const raw = points.map((p) => detectRaw(p.lat, p.lon));

  // Forward-fill nulls (open water, unmatched terrain)
  let last = raw.find((c) => c !== null) ?? COUNTRY_BOXES[0].code;
  const filled = raw.map((c) => {
    if (c !== null) last = c;
    return last;
  });

  // Rolling majority window (±2 = 5 points ≈ 50 km) to smooth GPS noise at borders
  const HALF = 2;
  const smooth = filled.map((_, i) => {
    const slice = filled.slice(Math.max(0, i - HALF), Math.min(n, i + HALF + 1));
    const counts = {};
    for (const c of slice) counts[c] = (counts[c] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  });

  // Build segments using actual cumulative distance for precise km-based percentages
  const segments = [];
  let curCode = smooth[0];
  let segStart = 0;

  for (let i = 1; i <= n; i++) {
    const code = i < n ? smooth[i] : null;

    if (code !== curCode) {
      const toDistance = i < n ? points[i].cumulativeDistanceMeters : totalDistanceM;
      const meta = COUNTRY_BOXES.find((b) => b.code === curCode);

      segments.push({
        code: curCode,
        flag: meta?.flag ?? "",
        color: meta?.color ?? "#888888",
        fromPercent: points[segStart].cumulativeDistanceMeters / totalDistanceM,
        toPercent: Math.min(toDistance / totalDistanceM, 1),
      });

      curCode = code;
      segStart = i;
    }
  }

  return segments.filter((s) => s.code && s.flag);
}

// Projekt-relativ aufgeloest, damit es auch aus Unterseiten wie /backup/ stimmt.
const projectRoot = new URL("../../", import.meta.url);

// Vorberechnete, echte Grenzuebertritte laden. Fallback ist die alte
// Box-Heuristik: die ist nachweislich ungenau, haelt aber Fortschrittsbalken
// und Zeitstrahl am Leben, falls die Datei mal fehlt.
export async function loadCountrySegments(routeData) {
  try {
    const response = await fetch(new URL("./src/route/country-crossings.json", projectRoot));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const totalKm = data.totalDistanceKm || routeData.totalDistanceKm;
    if (!Array.isArray(data.segments) || !data.segments.length || !totalKm) {
      throw new Error("country-crossings.json ohne verwertbare Segmente");
    }

    return data.segments
      .filter((segment) => COUNTRY_META[segment.code])
      .map((segment) => ({
        code: segment.code,
        flag: COUNTRY_META[segment.code].flag,
        color: COUNTRY_META[segment.code].color,
        fromPercent: segment.fromKm / totalKm,
        toPercent: Math.min(segment.toKm / totalKm, 1),
      }));
  } catch (error) {
    console.warn("[Laender] Vorberechnete Grenzen nicht nutzbar, nutze Box-Heuristik:", error.message);
    return buildCountrySegments(routeData);
  }
}
