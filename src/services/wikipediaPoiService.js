const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_VERSION = 1;
const cache = new Map();

function tileKey(lat, lon) {
  return `wiki_v${CACHE_VERSION}_${(lat * 5).toFixed(0)}_${(lon * 5).toFixed(0)}`;
}

// Patterns for entries that are not tourist POIs
const SKIP_DESC = /^(Bahnhof|Schule|Gymnasium|Hochschule|Universität|Amtsgericht|Gericht|Bücherei|Bibliothek|Feuerwehr|Krankenhaus|Klinik|Behörde|Verwaltung|Unternehmen|Firma|GmbH|AG|Stadtbezirk|Ortsteil|Fluss|Bach|Straße|Bundesstraße|Autobahn|Kanal|Gemeinschaft)/i;
const SKIP_TITLE = /^(Bahnhof|Schule|Gymnasium|Universität|Hochschule|Stadtbezirk|Ortsteil)/i;

const CATEGORY_RULES = [
  { desc: /nationalpark|naturschutzgebiet|naturpark/i,       category: "Nationalpark",      score: 0.88 },
  { desc: /aussichtspunkt|panorama/i,                        category: "Aussichtspunkt",    score: 0.78 },
  { title: /gipfel|berg|spitze|horn|kopf|joch|pass/i,       category: "Naturhighlight",    score: 0.76 },
  { desc: /berg|gipfel|gebirge/i,                            category: "Naturhighlight",    score: 0.74 },
  { desc: /wasserfall|schlucht|höhle|gletscher|see\b/i,      category: "Naturhighlight",    score: 0.70 },
  { desc: /burg|schloss|festung|palast|residenz/i,           category: "Sehenswuerdigkeit", score: 0.75 },
  { title: /burg|schloss|festung|ruine/i,                    category: "Sehenswuerdigkeit", score: 0.72 },
  { desc: /kloster|abtei|stift\b/i,                         category: "Sehenswuerdigkeit", score: 0.70 },
  { desc: /wahrzeichen|denkmal|monument|gedenkstätte/i,      category: "Sehenswuerdigkeit", score: 0.68 },
  { desc: /museum/i,                                         category: "Kulturort",         score: 0.72 },
  { title: /museum/i,                                        category: "Kulturort",         score: 0.70 },
  { desc: /kirchengebäude|kathedrale|dom\b|münster|basilika/i, category: "Kulturort",       score: 0.65 },
  { title: /kirche|kapelle|dom\b|münster|kloster|synagoge|moschee/i, category: "Kulturort", score: 0.63 },
  { desc: /historische?s? (gebäude|anlage|stadtanlage|altstadt)/i, category: "Sehenswuerdigkeit", score: 0.66 },
  { desc: /archäologisch|historisch/i,                       category: "Sehenswuerdigkeit", score: 0.62 },
];

function classifyPoi(title, description) {
  const desc = description || "";
  for (const rule of CATEGORY_RULES) {
    if (rule.desc && rule.desc.test(desc)) return { category: rule.category, score: rule.score };
    if (rule.title && rule.title.test(title))  return { category: rule.category, score: rule.score };
  }
  return null;
}

function cleanTitle(title) {
  return title.replace(/\s*\([^)]+\)\s*$/, "").trim();
}

export async function fetchWikipediaPois(lat, lon) {
  const key = tileKey(lat, lon);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.pois;
  }

  // Step 1: geosearch
  const controller1 = new AbortController();
  const t1 = setTimeout(() => controller1.abort(), 10000);
  let geoResults;
  try {
    const res = await fetch(
      `https://de.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=10000&gslimit=30&format=json&origin=*`,
      { signal: controller1.signal },
    );
    clearTimeout(t1);
    if (!res.ok) throw new Error(`Wikipedia HTTP ${res.status}`);
    const data = await res.json();
    geoResults = data.query?.geosearch ?? [];
  } catch (e) {
    clearTimeout(t1);
    const err = new Error(`Wikipedia geosearch failed: ${e.message}`);
    err.poiUnavailable = true;
    throw err;
  }

  if (!geoResults.length) {
    cache.set(key, { pois: [], timestamp: Date.now() });
    return [];
  }

  // Step 2: batch-fetch descriptions (optional, best-effort)
  const titleStr = geoResults.map((r) => encodeURIComponent(r.title)).join("|");
  const descMap = {};
  try {
    const controller2 = new AbortController();
    const t2 = setTimeout(() => controller2.abort(), 8000);
    const res = await fetch(
      `https://de.wikipedia.org/w/api.php?action=query&titles=${titleStr}&prop=description&format=json&origin=*`,
      { signal: controller2.signal },
    );
    clearTimeout(t2);
    if (res.ok) {
      const data = await res.json();
      Object.values(data.query?.pages ?? {}).forEach((p) => {
        if (p.description) descMap[p.title] = p.description;
      });
    }
  } catch (_) {
    // descriptions optional
  }

  // Merge, classify, filter
  const pois = geoResults
    .map((r) => {
      const desc = descMap[r.title] ?? null;
      if (desc && SKIP_DESC.test(desc)) return null;
      if (!desc && SKIP_TITLE.test(r.title)) return null;
      const classified = classifyPoi(r.title, desc);
      if (!classified) return null;
      return {
        name: cleanTitle(r.title),
        latitude: r.lat,
        longitude: r.lon,
        viewerCategory: classified.category,
        shortDescription: desc,
        score: classified.score,
        wikiTitle: r.title,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 80);

  cache.set(key, { pois, timestamp: Date.now() });
  return pois;
}
