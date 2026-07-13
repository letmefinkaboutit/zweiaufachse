const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_VERSION = 2;
const cache = new Map();

// Ab weniger als so vielen deutschen Treffern wird zusaetzlich die englische
// Wikipedia befragt — auf dem Balkan ist die de-Abdeckung duenn.
const EN_FALLBACK_THRESHOLD = 3;

function tileKey(lat, lon) {
  return `wiki_v${CACHE_VERSION}_${(lat * 5).toFixed(0)}_${(lon * 5).toFixed(0)}`;
}

// ── Deutsch ─────────────────────────────────────────────
const DE_SKIP_DESC = /^(Bahnhof|Schule|Gymnasium|Hochschule|Universität|Amtsgericht|Gericht|Bücherei|Bibliothek|Feuerwehr|Krankenhaus|Klinik|Behörde|Verwaltung|Unternehmen|Firma|GmbH|AG|Stadtbezirk|Ortsteil|Fluss|Bach|Straße|Bundesstraße|Autobahn|Kanal|Gemeinschaft)/i;
const DE_SKIP_TITLE = /^(Bahnhof|Schule|Gymnasium|Universität|Hochschule|Stadtbezirk|Ortsteil)/i;

const DE_CATEGORY_RULES = [
  { desc: /nationalpark|naturschutzgebiet|naturpark/i,       category: "Nationalpark",      score: 0.88 },
  { desc: /aussichtspunkt|panorama/i,                        category: "Aussichtspunkt",    score: 0.78 },
  { title: /gipfel|berg|spitze|horn|kopf|joch|pass/i,       category: "Naturhighlight",    score: 0.76 },
  { desc: /berg|gipfel|gebirge/i,                            category: "Naturhighlight",    score: 0.74 },
  { desc: /wasserfall|schlucht|höhle|gletscher|see\b/i,      category: "Naturhighlight",    score: 0.70 },
  { desc: /burg|schloss|festung|palast|residenz/i,           category: "Sehenswürdigkeit", score: 0.75 },
  { title: /burg|schloss|festung|ruine/i,                    category: "Sehenswürdigkeit", score: 0.72 },
  { desc: /kloster|abtei|stift\b/i,                         category: "Sehenswürdigkeit", score: 0.70 },
  { desc: /wahrzeichen|denkmal|monument|gedenkstätte/i,      category: "Sehenswürdigkeit", score: 0.68 },
  { desc: /museum/i,                                         category: "Kulturort",         score: 0.72 },
  { title: /museum/i,                                        category: "Kulturort",         score: 0.70 },
  { desc: /kirchengebäude|kathedrale|dom\b|münster|basilika/i, category: "Kulturort",       score: 0.65 },
  { title: /kirche|kapelle|dom\b|münster|kloster|synagoge|moschee/i, category: "Kulturort", score: 0.63 },
  { desc: /historische?s? (gebäude|anlage|stadtanlage|altstadt)/i, category: "Sehenswürdigkeit", score: 0.66 },
  { desc: /archäologisch|historisch/i,                       category: "Sehenswürdigkeit", score: 0.62 },
];

// ── Englisch (Fallback) ─────────────────────────────────
const EN_SKIP_DESC = /^(railway station|train station|school|university|college|company|business|municipality|district of|village in|river in|stream|road in|highway|motorway|football|sports? club|radio station|television)/i;
const EN_SKIP_TITLE = /railway station$|^university of/i;

const EN_CATEGORY_RULES = [
  { desc: /national park|nature reserve|protected area|nature park/i, category: "Nationalpark",      score: 0.88 },
  { desc: /viewpoint|observation (deck|tower)|panorama/i,             category: "Aussichtspunkt",    score: 0.78 },
  { title: /\bmount\b|\bpeak\b|\bpass\b/i,                            category: "Naturhighlight",    score: 0.76 },
  { desc: /mountain|summit|massif|highest point/i,                    category: "Naturhighlight",    score: 0.74 },
  { desc: /waterfall|canyon|gorge|cave|glacier|\blake\b/i,            category: "Naturhighlight",    score: 0.70 },
  { desc: /castle|fortress|palace|citadel/i,                          category: "Sehenswürdigkeit", score: 0.75 },
  { title: /castle|fortress|citadel|ruins?/i,                         category: "Sehenswürdigkeit", score: 0.72 },
  { desc: /monastery|abbey/i,                                         category: "Sehenswürdigkeit", score: 0.70 },
  { desc: /landmark|monument|memorial/i,                              category: "Sehenswürdigkeit", score: 0.68 },
  { desc: /museum/i,                                                  category: "Kulturort",         score: 0.72 },
  { title: /museum/i,                                                 category: "Kulturort",         score: 0.70 },
  { desc: /cathedral|church|basilica|mosque|synagogue/i,              category: "Kulturort",         score: 0.65 },
  { desc: /old town|historic (site|town|center|centre)/i,             category: "Sehenswürdigkeit", score: 0.66 },
  { desc: /archaeological|ancient/i,                                  category: "Sehenswürdigkeit", score: 0.64 },
];

const WIKI_SOURCES = {
  de: { host: "de.wikipedia.org", rules: DE_CATEGORY_RULES, skipDesc: DE_SKIP_DESC, skipTitle: DE_SKIP_TITLE },
  en: { host: "en.wikipedia.org", rules: EN_CATEGORY_RULES, skipDesc: EN_SKIP_DESC, skipTitle: EN_SKIP_TITLE },
};

function classifyPoi(rules, title, description) {
  const desc = description || "";
  for (const rule of rules) {
    if (rule.desc && rule.desc.test(desc)) return { category: rule.category, score: rule.score };
    if (rule.title && rule.title.test(title)) return { category: rule.category, score: rule.score };
  }
  return null;
}

function cleanTitle(title) {
  return title.replace(/\s*\([^)]+\)\s*$/, "").trim();
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFromSource(sourceKey, lat, lon) {
  const source = WIKI_SOURCES[sourceKey];

  // Schritt 1: Geosearch
  const res = await fetchWithTimeout(
    `https://${source.host}/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=10000&gslimit=30&format=json&origin=*`,
    10000,
  );
  if (!res.ok) throw new Error(`Wikipedia HTTP ${res.status}`);
  const data = await res.json();
  const geoResults = data.query?.geosearch ?? [];

  if (!geoResults.length) {
    return [];
  }

  // Schritt 2: Kurzbeschreibungen (optional, best effort)
  const titleStr = geoResults.map((r) => encodeURIComponent(r.title)).join("|");
  const descMap = {};
  try {
    const descRes = await fetchWithTimeout(
      `https://${source.host}/w/api.php?action=query&titles=${titleStr}&prop=description&format=json&origin=*`,
      8000,
    );
    if (descRes.ok) {
      const descData = await descRes.json();
      Object.values(descData.query?.pages ?? {}).forEach((p) => {
        if (p.description) descMap[p.title] = p.description;
      });
    }
  } catch {
    // Beschreibungen sind optional
  }

  return geoResults
    .map((r) => {
      const desc = descMap[r.title] ?? null;
      if (desc && source.skipDesc.test(desc)) return null;
      if (!desc && source.skipTitle.test(r.title)) return null;
      const classified = classifyPoi(source.rules, r.title, desc);
      if (!classified) return null;
      return {
        name: cleanTitle(r.title),
        latitude: r.lat,
        longitude: r.lon,
        viewerCategory: classified.category,
        shortDescription: desc,
        score: classified.score,
        wikiTitle: r.title,
        wikiLang: sourceKey,
      };
    })
    .filter(Boolean);
}

// Dedupe ueber Sprachen: gleicher (bereinigter) Name oder praktisch gleiche
// Koordinate = derselbe Ort; der de-Eintrag gewinnt.
function mergePois(dePois, enPois) {
  const seenNames = new Set(dePois.map((p) => p.name.toLowerCase()));
  const seenCoords = new Set(dePois.map((p) => `${p.latitude.toFixed(3)},${p.longitude.toFixed(3)}`));

  const merged = [...dePois];
  for (const poi of enPois) {
    if (seenNames.has(poi.name.toLowerCase())) continue;
    if (seenCoords.has(`${poi.latitude.toFixed(3)},${poi.longitude.toFixed(3)}`)) continue;
    merged.push(poi);
  }
  return merged;
}

export async function fetchWikipediaPois(lat, lon) {
  const key = tileKey(lat, lon);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.pois;
  }

  let dePois;
  try {
    dePois = await fetchFromSource("de", lat, lon);
  } catch (e) {
    const err = new Error(`Wikipedia geosearch failed: ${e.message}`);
    err.poiUnavailable = true;
    throw err;
  }

  let pois = dePois;
  if (dePois.length < EN_FALLBACK_THRESHOLD) {
    try {
      const enPois = await fetchFromSource("en", lat, lon);
      pois = mergePois(dePois, enPois);
    } catch {
      // en ist nur Fallback — das de-Ergebnis (auch leer) reicht
    }
  }

  pois = pois.sort((a, b) => b.score - a.score).slice(0, 80);

  cache.set(key, { pois, timestamp: Date.now() });
  return pois;
}
