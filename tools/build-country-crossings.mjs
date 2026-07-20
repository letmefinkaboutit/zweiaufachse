// Ermittelt die tatsaechlichen Grenzuebertritte entlang der Route.
//
// Warum ueberhaupt ein Build-Schritt: Zur Laufzeit wurden die Laender aus
// Bounding-Boxen geraten. Boxen sind Rechtecke, Grenzen nicht — die DE- und
// die AT-Box ueberlappten sich ueber halb Oberbayern, und weil die kleinere
// Box gewann, galt dort alles suedlich von 47.8 N als Oesterreich. Der
// deutsch-oesterreichische Uebertritt lag dadurch rund 75 km zu frueh.
//
// Hier wird stattdessen einmalig gegen echte OSM-Grenzen aufgeloest
// (Nominatim reverse) und das Ergebnis als kleine JSON-Datei abgelegt. Die
// App liest nur noch fertige Kilometerwerte.
//
// Aufruf:  node tools/build-country-crossings.mjs
//
// Nominatim-Nutzungsregeln: max. 1 Anfrage/Sekunde, identifizierender
// User-Agent. Beides wird hier eingehalten; Ergebnisse landen zusaetzlich in
// einem Cache, damit ein zweiter Lauf fast ohne Anfragen auskommt.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ROUTE_FILE = path.join(root, "src/route/route-data.json");
const OUT_FILE = path.join(root, "src/route/country-crossings.json");
const CACHE_FILE = path.join(root, "tools/.nominatim-cache.json");

const USER_AGENT = "zweiaufachse-tour-app/1.0 (https://zweiaufachse.thefinks.de)";
const REQUEST_DELAY_MS = 1100;

// Grobraster: kleiner als der kuerzeste Landdurchgang der Route, sonst wuerde
// ein kurz durchquertes Land komplett uebersehen.
const COARSE_STEP_KM = 10;

// Bis auf welche Genauigkeit der Uebergang eingegabelt wird.
const PRECISION_M = 100;

const cache = fs.existsSync(CACHE_FILE)
  ? JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"))
  : {};

let requestCount = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function countryAt(lat, lon) {
  // 5 Nachkommastellen ~ 1 m; als Cache-Schluessel voellig ausreichend.
  const key = `${lat.toFixed(5)},${lon.toFixed(5)}`;
  if (cache[key] !== undefined) return cache[key];

  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=3&addressdetails=1`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await sleep(REQUEST_DELAY_MS);
      requestCount++;
      const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const code = data?.address?.country_code?.toUpperCase() ?? null;

      cache[key] = code;
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
      return code;
    } catch (error) {
      console.warn(`  Versuch ${attempt} fuer ${key} fehlgeschlagen: ${error.message}`);
      if (attempt === 3) {
        cache[key] = null;
        return null;
      }
      await sleep(2000 * attempt);
    }
  }

  return null;
}

const route = JSON.parse(fs.readFileSync(ROUTE_FILE, "utf8"));
const points = route.points;            // [lat, lon, ele, cumMeters]
const totalM = points.at(-1)[3];

console.log(`Route: ${points.length} Punkte, ${(totalM / 1000).toFixed(1)} km`);

// Punkt an einer bestimmten Streckenposition (Meter) finden.
function pointAtMeters(meters) {
  let low = 0;
  let high = points.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (points[mid][3] < meters) low = mid + 1;
    else high = mid;
  }
  return points[low];
}

// ── 1) Grobraster ───────────────────────────────────────
const stepM = COARSE_STEP_KM * 1000;
const coarse = [];

for (let m = 0; m <= totalM; m += stepM) {
  const point = pointAtMeters(m);
  const code = await countryAt(point[0], point[1]);
  coarse.push({ meters: m, code });
  process.stdout.write(`\rGrobraster: ${(m / 1000).toFixed(0)}/${(totalM / 1000).toFixed(0)} km  (${code})   `);
}

// Endpunkt sicher mitnehmen
const lastPoint = points.at(-1);
const lastCode = await countryAt(lastPoint[0], lastPoint[1]);
coarse.push({ meters: totalM, code: lastCode });
console.log("\n");

// Luecken (Nominatim ohne Antwort) mit dem vorherigen Land fuellen.
for (let i = 0; i < coarse.length; i++) {
  if (coarse[i].code === null && i > 0) coarse[i].code = coarse[i - 1].code;
}

// ── 2) Uebergaenge einzeln eingabeln ────────────────────
const crossings = [];

for (let i = 1; i < coarse.length; i++) {
  if (!coarse[i].code || coarse[i].code === coarse[i - 1].code) continue;

  let low = coarse[i - 1].meters;    // sicher im alten Land
  let high = coarse[i].meters;       // sicher im neuen Land
  const fromCode = coarse[i - 1].code;
  const toCode = coarse[i].code;

  while (high - low > PRECISION_M) {
    const mid = Math.round((low + high) / 2);
    const point = pointAtMeters(mid);
    const code = await countryAt(point[0], point[1]);

    // Unbekannt: Intervall vorsichtig von unten verkleinern, statt zu raten.
    if (code === null) { low = mid; continue; }
    if (code === fromCode) low = mid;
    else high = mid;
  }

  const point = pointAtMeters(high);
  crossings.push({
    fromCode,
    toCode,
    km: +(high / 1000).toFixed(2),
    lat: +point[0].toFixed(5),
    lon: +point[1].toFixed(5),
  });

  console.log(`${fromCode} -> ${toCode} bei km ${(high / 1000).toFixed(2)}  (${point[0].toFixed(4)}, ${point[1].toFixed(4)})`);
}

// ── 3) Segmente daraus bauen ────────────────────────────
const segments = [];
let startKm = 0;
let code = coarse[0].code;

for (const crossing of crossings) {
  segments.push({ code, fromKm: +startKm.toFixed(2), toKm: crossing.km });
  startKm = crossing.km;
  code = crossing.toCode;
}
segments.push({ code, fromKm: +startKm.toFixed(2), toKm: +(totalM / 1000).toFixed(2) });

const output = {
  generatedAt: new Date().toISOString(),
  generatedBy: "tools/build-country-crossings.mjs",
  source: "Nominatim reverse geocoding (OpenStreetMap), zoom=3",
  totalDistanceKm: +(totalM / 1000).toFixed(2),
  precisionMeters: PRECISION_M,
  coarseStepKm: COARSE_STEP_KM,
  segments,
  crossings,
};

fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));

console.log(`\n${requestCount} Anfragen an Nominatim.`);
console.log(`\nSegmente:`);
for (const segment of segments) {
  console.log(`  ${segment.code}  ${segment.fromKm.toFixed(1)} – ${segment.toKm.toFixed(1)} km  (${(segment.toKm - segment.fromKm).toFixed(1)} km)`);
}
console.log(`\nGeschrieben: ${path.relative(root, OUT_FILE)}`);
