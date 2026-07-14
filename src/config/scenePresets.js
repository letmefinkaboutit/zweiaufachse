// Presets fuer die Living Scene: pro Land ein Landschafts-/Trikot-Bild,
// pro Wetterlage ein Szenen-Zustand. Damit ist die Szene fuer die gesamte
// Tour vorbereitet — von Schorndorf bis Volos.

// ── Trikots: Flaggen der Reiselaender ────────────────────
// Jedes Trikot wird als SVG-Fragment in den Ruecken von Timo gezeichnet
// (Rumpf-Pfad: M364 740 Q400 726 436 740 L446 852 Q400 868 354 852 Z).
// "base" faerbt den Rumpf, "overlay" legt Streifen/Symbole darueber.
const STRIPES_H = (colors) =>
  colors
    .map((c, i) => {
      const h = 128 / colors.length;
      const y = 730 + i * h;
      return `<rect x="352" y="${y.toFixed(1)}" width="96" height="${h.toFixed(1)}" fill="${c}"/>`;
    })
    .join("");

const STRIPES_V = (colors) =>
  colors
    .map((c, i) => {
      const w = 96 / colors.length;
      const x = 352 + i * w;
      return `<rect x="${x.toFixed(1)}" y="730" width="${w.toFixed(1)}" height="128" fill="${c}"/>`;
    })
    .join("");

export const countryPresets = {
  DE: {
    name: "Deutschland",
    jersey: { base: "#2b2b2b", overlay: STRIPES_H(["#2b2b2b", "#d03a2b", "#e8b23a"]) },
    landscape: "hills",
    hillFar: "#b3c4b0",
    hillNear: "#93ab90",
    field: "#a3bd94",
    village: "gable",
    tree: "conifer",
  },
  AT: {
    name: "Österreich",
    jersey: { base: "#ED2939", overlay: STRIPES_H(["#ED2939", "#fffdf8", "#ED2939"]) },
    landscape: "alps",
    hillFar: "#c2cfd4",
    hillNear: "#8fa79c",
    field: "#9ab88c",
    village: "chalet",
    tree: "conifer",
    snowCaps: true,
  },
  IT: {
    name: "Italien",
    jersey: { base: "#009246", overlay: STRIPES_V(["#009246", "#fffdf8", "#CE2B37"]) },
    landscape: "hills",
    hillFar: "#c3c9a8",
    hillNear: "#a8b184",
    field: "#bcc389",
    village: "campanile",
    tree: "cypress",
  },
  SI: {
    name: "Slowenien",
    jersey: { base: "#fffdf8", overlay: STRIPES_H(["#fffdf8", "#003DA5", "#D50000"]) },
    landscape: "alps",
    hillFar: "#bcc9c4",
    hillNear: "#87a190",
    field: "#9dbb8f",
    village: "chalet",
    tree: "conifer",
    snowCaps: true,
  },
  HR: {
    name: "Kroatien",
    jersey: { base: "#FF0000", overlay: STRIPES_H(["#FF0000", "#fffdf8", "#171796"]) },
    landscape: "coast",
    hillFar: "#c6c2a6",
    hillNear: "#a9a683",
    field: "#b6b98a",
    village: "stone",
    tree: "cypress",
    sea: true,
  },
  BA: {
    name: "Bosnien & Herzegowina",
    jersey: {
      base: "#1e4a9e",
      overlay: `
        <path d="M377 748 L437 806 L437 748 Z" fill="#f4c430"/>
        <g fill="#fffdf8">
          <circle cx="380" cy="760" r="2.6"/><circle cx="389" cy="774" r="2.6"/>
          <circle cx="398" cy="788" r="2.6"/><circle cx="407" cy="802" r="2.6"/>
        </g>`,
    },
    landscape: "mountains",
    hillFar: "#b3c4b0",
    hillNear: "#93ab90",
    field: "#a3bd94",
    village: "minaret",
    tree: "conifer",
    river: true,
  },
  ME: {
    name: "Montenegro",
    jersey: {
      base: "#C40308",
      overlay: `
        <rect x="358" y="736" width="84" height="116" fill="none" stroke="#D4AF37" stroke-width="6"/>
        <circle cx="400" cy="794" r="17" fill="#D4AF37" opacity="0.9"/>`,
    },
    landscape: "mountains",
    hillFar: "#b0b8b4",
    hillNear: "#8b9a8f",
    field: "#9db78e",
    village: "stone",
    tree: "conifer",
  },
  AL: {
    name: "Albanien",
    jersey: {
      base: "#E41E20",
      overlay: `
        <path d="M382 776 L400 764 L418 776 L410 800 L400 790 L390 800 Z" fill="#1c1c1c"/>`,
    },
    landscape: "mountains",
    hillFar: "#c0c3aa",
    hillNear: "#9fa886",
    field: "#adb98a",
    village: "stone",
    tree: "olive",
  },
  MK: {
    name: "Nordmazedonien",
    jersey: {
      base: "#CE2028",
      overlay: `
        <g stroke="#F8E92E" stroke-width="7" stroke-linecap="round">
          <line x1="400" y1="794" x2="356" y2="738"/><line x1="400" y1="794" x2="444" y2="738"/>
          <line x1="400" y1="794" x2="352" y2="794"/><line x1="400" y1="794" x2="448" y2="794"/>
          <line x1="400" y1="794" x2="360" y2="854"/><line x1="400" y1="794" x2="440" y2="854"/>
        </g>
        <circle cx="400" cy="794" r="13" fill="#F8E92E"/>`,
    },
    landscape: "hills",
    hillFar: "#c2c5a6",
    hillNear: "#a3ab82",
    field: "#b0ba88",
    village: "stone",
    tree: "olive",
  },
  GR: {
    name: "Griechenland",
    jersey: {
      base: "#0D5EAF",
      overlay:
        STRIPES_H(["#0D5EAF", "#fffdf8", "#0D5EAF", "#fffdf8", "#0D5EAF"]) +
        `<rect x="352" y="730" width="42" height="51" fill="#0D5EAF"/>
         <g fill="#fffdf8">
           <rect x="368" y="734" width="10" height="43"/>
           <rect x="352" y="750" width="42" height="10"/>
         </g>`,
    },
    landscape: "coast",
    hillFar: "#c9c4a4",
    hillNear: "#b0aa80",
    field: "#bfc088",
    village: "whitehouse",
    tree: "olive",
    sea: true,
  },
};

export const defaultCountry = "DE";

export function getCountryPreset(code) {
  return countryPresets[code] ?? countryPresets[defaultCountry];
}

// ── Wetter: WMO-Codes (Open-Meteo) ──────────────────────
// https://open-meteo.com/en/docs — Weather interpretation codes
export const weatherPresets = [
  { max: 0,  key: "clear",     sceneClass: "",                 icon: "☀️", nightIcon: "🌙", label: "klar" },
  { max: 2,  key: "partly",    sceneClass: "",                 icon: "🌤", nightIcon: "🌙", label: "leicht bewölkt" },
  { max: 3,  key: "overcast",  sceneClass: "scene--overcast",  icon: "☁️", nightIcon: "☁️", label: "bedeckt" },
  { max: 48, key: "fog",       sceneClass: "scene--fog",       icon: "🌫", nightIcon: "🌫", label: "Nebel" },
  { max: 57, key: "drizzle",   sceneClass: "scene--rain",      icon: "🌦", nightIcon: "🌦", label: "Nieselregen" },
  { max: 67, key: "rain",      sceneClass: "scene--rain",      icon: "🌧", nightIcon: "🌧", label: "Regen" },
  { max: 77, key: "snow",      sceneClass: "scene--snow",      icon: "🌨", nightIcon: "🌨", label: "Schnee" },
  { max: 82, key: "showers",   sceneClass: "scene--rain",      icon: "🌧", nightIcon: "🌧", label: "Schauer" },
  { max: 86, key: "snow",      sceneClass: "scene--snow",      icon: "🌨", nightIcon: "🌨", label: "Schneeschauer" },
  { max: 99, key: "thunder",   sceneClass: "scene--rain scene--thunder", icon: "⛈", nightIcon: "⛈", label: "Gewitter" },
];

export function getWeatherPreset(code) {
  return weatherPresets.find((p) => code <= p.max) ?? weatherPresets[0];
}
