// Wandelt die GPX-Route in ein kompaktes JSON um, das die App direkt laedt.
//
// Aufruf (aus dem Projekt-Root):
//   node tools/build-route-data.mjs ["src/route/Meine Route.gpx"]
//
// Bei einer Routenaenderung unterwegs: neue GPX-Datei ablegen, Script laufen
// lassen, committen, pushen — der Deploy verteilt das neue route-data.json.
//
// Die Simplifizierung (Douglas-Peucker, 10 m Toleranz) behaelt jeden Punkt,
// an dem die Strecke tatsaechlich abbiegt. Kumulative Distanzen und
// Hoehenkennzahlen werden vorher auf dem VOLLEN Track berechnet, damit
// Gesamtdistanz und Hoehenmeter exakt den Originalwerten entsprechen.

import { readFileSync, writeFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const TOLERANCE_METERS = 10;
const EARTH_RADIUS_METERS = 6371000;

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const gpxPath = resolve(projectRoot, process.argv[2] ?? "src/route/Schorndorf - Kritharia Alternative.gpx");
const outPath = resolve(projectRoot, "src/route/route-data.json");

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function haversineMeters(a, b) {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function parseGpx(xml) {
  const nameMatch = xml.match(/<name>([^<]*)<\/name>/);
  const points = [];
  const re = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"\s*>([\s\S]*?)<\/trkpt>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const eleMatch = m[3].match(/<ele>([^<]+)<\/ele>/);
    points.push({
      lat: Number.parseFloat(m[1]),
      lon: Number.parseFloat(m[2]),
      ele: eleMatch ? Number.parseFloat(eleMatch[1]) : 0,
    });
  }
  if (!points.length) {
    throw new Error("Keine <trkpt>-Punkte in der GPX-Datei gefunden.");
  }
  return { name: nameMatch?.[1]?.trim() || "Tourroute", points };
}

// Douglas-Peucker, iterativ (Rekursionstiefe bei 86k Punkten zu riskant).
// Abstand wird planar in Metern gerechnet (equirektangulare Projektion) —
// auf Segmentlaengen von wenigen km mehr als genau genug fuer 10 m Toleranz.
function simplify(points, toleranceMeters) {
  const n = points.length;
  if (n <= 2) return points.map((_, i) => i);

  const midLat = toRadians((points[0].lat + points[n - 1].lat) / 2);
  const kx = 111320 * Math.cos(midLat);
  const ky = 110574;
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    xs[i] = points[i].lon * kx;
    ys[i] = points[i].lat * ky;
  }

  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack = [[0, n - 1]];

  while (stack.length) {
    const [start, end] = stack.pop();
    if (end - start < 2) continue;

    const ax = xs[start], ay = ys[start];
    const dx = xs[end] - ax, dy = ys[end] - ay;
    const lenSq = dx * dx + dy * dy;

    let maxDistSq = -1;
    let maxIdx = -1;
    for (let i = start + 1; i < end; i++) {
      let distSq;
      if (lenSq === 0) {
        const ex = xs[i] - ax, ey = ys[i] - ay;
        distSq = ex * ex + ey * ey;
      } else {
        const cross = dx * (ys[i] - ay) - dy * (xs[i] - ax);
        distSq = (cross * cross) / lenSq;
      }
      if (distSq > maxDistSq) {
        maxDistSq = distSq;
        maxIdx = i;
      }
    }

    if (maxDistSq > toleranceMeters * toleranceMeters) {
      keep[maxIdx] = 1;
      stack.push([start, maxIdx], [maxIdx, end]);
    }
  }

  const indices = [];
  for (let i = 0; i < n; i++) if (keep[i]) indices.push(i);
  return indices;
}

// ── Ablauf ──────────────────────────────────────────────

const xml = readFileSync(gpxPath, "utf8");
const { name, points } = parseGpx(xml);

// Kennzahlen auf dem vollen Track
const cumulative = new Float64Array(points.length);
let elevationGain = 0;
let elevationLoss = 0;
let minEle = Number.POSITIVE_INFINITY;
let maxEle = Number.NEGATIVE_INFINITY;
const bounds = {
  minLat: Number.POSITIVE_INFINITY,
  maxLat: Number.NEGATIVE_INFINITY,
  minLon: Number.POSITIVE_INFINITY,
  maxLon: Number.NEGATIVE_INFINITY,
};

for (let i = 0; i < points.length; i++) {
  const p = points[i];
  bounds.minLat = Math.min(bounds.minLat, p.lat);
  bounds.maxLat = Math.max(bounds.maxLat, p.lat);
  bounds.minLon = Math.min(bounds.minLon, p.lon);
  bounds.maxLon = Math.max(bounds.maxLon, p.lon);
  minEle = Math.min(minEle, p.ele);
  maxEle = Math.max(maxEle, p.ele);
  if (i > 0) {
    cumulative[i] = cumulative[i - 1] + haversineMeters(points[i - 1], p);
    const delta = p.ele - points[i - 1].ele;
    if (delta > 0) elevationGain += delta;
    else elevationLoss -= delta;
  }
}

const keptIndices = simplify(points, TOLERANCE_METERS);

// Kompaktformat: [lat, lon, ele, kumulierte Meter] — cum stammt vom vollen
// Track, dadurch bleibt der Streckenfortschritt exakt.
const compactPoints = keptIndices.map((i) => [
  Number(points[i].lat.toFixed(5)),
  Number(points[i].lon.toFixed(5)),
  Number(points[i].ele.toFixed(1)),
  Math.round(cumulative[i]),
]);

const output = {
  schema: 1,
  name,
  sourceFile: gpxPath.slice(projectRoot.length + 1),
  toleranceMeters: TOLERANCE_METERS,
  originalPointsCount: points.length,
  pointsCount: compactPoints.length,
  totalDistanceMeters: Math.round(cumulative[points.length - 1]),
  elevationGainMeters: Math.round(elevationGain),
  elevationLossMeters: Math.round(elevationLoss),
  minElevation: Number(minEle.toFixed(1)),
  maxElevation: Number(maxEle.toFixed(1)),
  bounds: {
    minLat: Number(bounds.minLat.toFixed(5)),
    maxLat: Number(bounds.maxLat.toFixed(5)),
    minLon: Number(bounds.minLon.toFixed(5)),
    maxLon: Number(bounds.maxLon.toFixed(5)),
  },
  points: compactPoints,
};

writeFileSync(outPath, JSON.stringify(output));

const inSize = statSync(gpxPath).size;
const outSize = statSync(outPath).size;
console.log(`Route:        ${name}`);
console.log(`Punkte:       ${points.length} -> ${compactPoints.length} (Toleranz ${TOLERANCE_METERS} m)`);
console.log(`Distanz:      ${(cumulative[points.length - 1] / 1000).toFixed(1)} km`);
console.log(`Hoehenmeter:  +${Math.round(elevationGain)} / -${Math.round(elevationLoss)}`);
console.log(`Dateigroesse: ${(inSize / 1e6).toFixed(1)} MB -> ${(outSize / 1e3).toFixed(0)} KB`);
console.log(`Geschrieben:  ${outPath}`);
