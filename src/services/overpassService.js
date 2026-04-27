const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];
const RADIUS_M = 10000;
const CACHE_TTL_MS = 30 * 60 * 1000;

const cache = new Map();
const CACHE_VERSION = 7;

// Round to ~20km grid cell to avoid re-querying on small movements
function tileKey(lat, lon) {
  return `v${CACHE_VERSION}_${(lat * 10).toFixed(0)}_${(lon * 10).toFixed(0)}`;
}

const HISTORIC_SET = new Set(["castle","fort","palace","monastery","abbey","ruins","ruin","memorial","monument","cathedral","church","archaeological_site","city_gate"]);

const CATEGORY_MAP = [
  { test: (t) => t.tourism === "viewpoint",                                          category: "Aussichtspunkt",    score: 0.8  },
  { test: (t) => t.natural === "peak",                                               category: "Naturhighlight",    score: 0.75 },
  { test: (t) => t.boundary === "national_park" || t.leisure === "nature_reserve",   category: "Nationalpark",      score: 0.9  },
  { test: (t) => t.tourism === "museum",                                             category: "Kulturort",         score: 0.7  },
  { test: (t) => t.tourism === "artwork",                                            category: "Kulturort",         score: 0.55 },
  { test: (t) => HISTORIC_SET.has(t.historic),                                      category: "Sehenswuerdigkeit", score: 0.72 },
  { test: (t) => t.historic && t.tourism === "attraction",                           category: "Sehenswuerdigkeit", score: 0.68 },
  { test: (t) => t.tourism === "attraction",                                         category: "Sehenswuerdigkeit", score: 0.6  },
  { test: (t) => t.amenity === "place_of_worship",                                  category: "Kulturort",         score: 0.6  },
  { test: (t) => t.tourism === "alpine_hut",                                        category: "Etappenort",        score: 0.65 },
];

function mapPoi(el) {
  if (!el.tags?.name) return null;
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (lat == null || lon == null) return null;
  const tags = el.tags;

  for (const rule of CATEGORY_MAP) {
    if (rule.test(tags)) {
      const desc = tags["description:de"] || tags.description || buildAutoDesc(tags);
      return {
        name: tags.name,
        latitude: lat,
        longitude: lon,
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

const HISTORIC_REGEX = "castle|fort|palace|monastery|abbey|ruins|ruin|memorial|monument|archaeological_site|city_gate";

function buildQuery(lat, lon) {
  const r = RADIUS_M;
  return `[out:json][timeout:10];
(
  node(around:${r},${lat},${lon})["tourism"="viewpoint"]["name"];
  node(around:${r},${lat},${lon})["natural"="peak"]["name"];
  node(around:${r},${lat},${lon})["historic"~"${HISTORIC_REGEX}"]["name"];
  node(around:${r},${lat},${lon})["tourism"~"museum|attraction"]["name"];
  node(around:${r},${lat},${lon})["tourism"="alpine_hut"]["name"];
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
  let response;
  let lastErr;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);
    try {
      response = await fetch(endpoint, {
        method: "POST",
        body: "data=" + encodeURIComponent(query),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (response.ok) break;
      lastErr = new Error(`Overpass HTTP ${response.status} (${endpoint})`);
      response = null;
    } catch (e) {
      clearTimeout(timeoutId);
      lastErr = e;
      response = null;
    }
  }

  if (!response) {
    const err = lastErr || new Error("All Overpass endpoints failed");
    err.overpassUnavailable = true;
    throw err;
  }

  const data = await response.json();
  if (data.remark?.includes("timed out") || data.remark?.includes("error")) {
    throw new Error(`Overpass: ${data.remark}`);
  }

  const pois = (data.elements || [])
    .map(mapPoi)
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 80);

  cache.set(key, { pois, timestamp: Date.now() });
  return pois;
}
