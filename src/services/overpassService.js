const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const RADIUS_M = 40000;
const CACHE_TTL_MS = 30 * 60 * 1000;

const cache = new Map();

// Round to ~20km grid cell to avoid re-querying on small movements
function tileKey(lat, lon) {
  return `${(lat * 5).toFixed(0)}_${(lon * 5).toFixed(0)}`;
}

const CATEGORY_MAP = [
  { test: (t) => t.tourism === "viewpoint",                             category: "Aussichtspunkt",      score: 0.8 },
  { test: (t) => t.natural === "peak",                                  category: "Naturhighlight",      score: 0.75 },
  { test: (t) => t.boundary === "national_park" || t.leisure === "nature_reserve", category: "Nationalpark", score: 0.9 },
  { test: (t) => t.tourism === "museum",                                category: "Kulturort",           score: 0.7 },
  { test: (t) => t.tourism === "artwork",                               category: "Kulturort",           score: 0.55 },
  { test: (t) => ["castle","monastery","abbey","ruins","memorial","monument","cathedral","church"].includes(t.historic), category: "Sehenswuerdigkeit", score: 0.72 },
  { test: (t) => t.historic && t.tourism === "attraction",              category: "Sehenswuerdigkeit",   score: 0.68 },
  { test: (t) => t.tourism === "attraction",                            category: "Sehenswuerdigkeit",   score: 0.6 },
  { test: (t) => t.tourism === "alpine_hut",                            category: "Etappenort",          score: 0.65 },
];

function mapPoi(el) {
  if (!el.tags?.name || el.lat == null || el.lon == null) return null;
  const tags = el.tags;

  for (const rule of CATEGORY_MAP) {
    if (rule.test(tags)) {
      const desc = tags["description:de"] || tags.description || buildAutoDesc(tags);
      return {
        name: tags.name,
        latitude: el.lat,
        longitude: el.lon,
        viewerCategory: rule.category,
        shortDescription: desc,
        score: rule.score,
        osmId: el.id,
      };
    }
  }
  return null;
}

function buildAutoDesc(tags) {
  if (tags.natural === "peak" && tags.ele) return `${tags.ele} m ü. M.`;
  if (tags.historic) return tags.historic.charAt(0).toUpperCase() + tags.historic.slice(1);
  return null;
}

function buildQuery(lat, lon) {
  const r = RADIUS_M;
  return `[out:json][timeout:25];
(
  node(around:${r},${lat},${lon})["tourism"~"^(viewpoint|attraction|museum|artwork|alpine_hut)$"]["name"];
  node(around:${r},${lat},${lon})["natural"="peak"]["name"];
  node(around:${r},${lat},${lon})["historic"]["name"];
);
out body;`;
}

export async function fetchOverpassPois(lat, lon) {
  const key = tileKey(lat, lon);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.pois;
  }

  const query = buildQuery(lat, lon);
  const response = await fetch(OVERPASS_URL, {
    method: "POST",
    body: "data=" + encodeURIComponent(query),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  if (!response.ok) throw new Error(`Overpass error ${response.status}`);

  const data = await response.json();
  const pois = (data.elements || [])
    .map(mapPoi)
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 80);

  cache.set(key, { pois, timestamp: Date.now() });
  return pois;
}
