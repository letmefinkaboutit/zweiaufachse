const INK = "#27323a";
const PAPER = "#fffdf8";
const GREEN = "#0c6b58";
const ORANGE = "#eb8f34";
const HELLAS_BLUE = "#078fc4";
const HELLAS_DARK = "#075f8e";

const contextLabels = {
  weather: {
    sunny: "sonnig",
    cloudy: "bewölkt",
    rain: "Regen",
    wind: "windig",
  },
  time: {
    morning: "morgens",
    midday: "mittags",
    afternoon: "nachmittags",
    evening: "abends",
    night: "nachts",
  },
  terrain: {
    village: "im Ort",
    open: "im freien Feld",
    forest: "im Wald",
    mountain: "in den Bergen",
    coast: "an der Küste",
  },
};

function rider({ x, y, color, skin = "#e8b48c", flip = false, mood = "smile", className = "" }) {
  // In den Referenzbildern ist Fahrer A an der Brille erkennbar, Fahrer B
  // an den weißen Seitenfeldern des Helms. Die Radfarbe bestimmt hier nur,
  // welcher der beiden Protagonisten gemeint ist.
  const isRiderA = color !== ORANGE;
  const mouth = mood === "sleep"
    ? `<path d="M-7 -94 q7 -3 14 0" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
    : `<path d="M-8 -95 q8 8 16 0" stroke="${INK}" stroke-width="2.4" fill="${PAPER}" stroke-linecap="round"/>`;
  const glasses = isRiderA
    ? `
      <g fill="none" stroke="${INK}" stroke-width="2.2">
        <rect x="-14" y="-109" width="12" height="10" rx="4"/>
        <rect x="2" y="-109" width="12" height="10" rx="4"/>
        <path d="M-2 -104 H2 M-14 -106 l-5 -2 M14 -106 l5 -2"/>
      </g>
    `
    : "";
  const helmetPanels = isRiderA
    ? `<path d="M-14 -116 Q0 -124 14 -116" fill="none" stroke="#4fc5ee" stroke-width="4"/>`
    : `
      <path d="M-18 -108 Q-14 -119 -5 -122 L-3 -109 Z" fill="${PAPER}"/>
      <path d="M18 -108 Q14 -119 5 -122 L3 -109 Z" fill="${PAPER}"/>
    `;

  return `
    <g transform="translate(${x} ${y}) ${flip ? "scale(-1 1)" : ""}">
      <g class="${className}">
        <path d="M-16 0 L-10 -38 M16 0 L10 -38" stroke="#2b3a41" stroke-width="11" stroke-linecap="round"/>
        <path d="M-18 -38 Q0 -50 18 -38 L14 -82 Q0 -89 -14 -82 Z" fill="${HELLAS_BLUE}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
        <path d="M-16 -59 Q0 -64 16 -59 L15 -48 Q0 -53 -15 -48 Z" fill="${PAPER}"/>
        <path d="M-2 -59 V-49 M-7 -54 H4" stroke="${HELLAS_BLUE}" stroke-width="2"/>
        <path d="M0 -84 V-39" stroke="${HELLAS_DARK}" stroke-width="1.8" opacity="0.8"/>
        <path d="M-11 -72 Q-28 -57 -30 -40" stroke="${skin}" stroke-width="9" stroke-linecap="round" fill="none"/>
        <path d="M11 -72 Q27 -58 29 -40" stroke="${skin}" stroke-width="9" stroke-linecap="round" fill="none"/>
        <circle cx="0" cy="-101" r="20" fill="${skin}" stroke="${INK}" stroke-width="4"/>
        <path d="M-20 -104 A21 19 0 0 1 20 -104 L17 -111 Q0 -124 -17 -111 Z" fill="${HELLAS_BLUE}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
        ${helmetPanels}
        <path d="M-7 -119 L-4 -108 M7 -119 L4 -108" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
        <circle cx="-7" cy="-104" r="2.2" fill="${INK}"/>
        <circle cx="7" cy="-104" r="2.2" fill="${INK}"/>
        ${glasses}
        ${mouth}
      </g>
    </g>
  `;
}

function bike({ x, y, color = GREEN, scale = 1, flat = false, className = "" }) {
  return `
    <g transform="translate(${x} ${y}) scale(${scale}) ${flat ? "rotate(-8)" : ""}">
      <g class="${className}">
        <circle cx="0" cy="0" r="28" fill="none" stroke="${INK}" stroke-width="6"/>
        <circle cx="86" cy="0" r="28" fill="none" stroke="${INK}" stroke-width="6"/>
        <g stroke="#8a938f" stroke-width="2">
          <path d="M-22 0 H22 M0 -22 V22 M64 0 H108 M86 -22 V22"/>
        </g>
        <path d="M0 0 L35 -10 L20 -50 L0 0 M35 -10 L66 -49 M20 -50 H66 M66 -49 L86 0"
          fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12 -53 H28 M67 -52 L78 -56" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
        <circle cx="35" cy="-10" r="5" fill="${INK}"/>
      </g>
    </g>
  `;
}

function landscape(id, { night = false, rain = false, coast = false, forest = false } = {}) {
  const skyTop = night ? "#14233b" : rain ? "#aebfc8" : "#f7dca5";
  const skyBottom = night ? "#29405d" : rain ? "#d7e0e1" : "#faefd4";
  const hill = night ? "#34515a" : rain ? "#77928a" : "#93ab90";
  const ground = night ? "#29413e" : rain ? "#8aa39a" : "#a3bd94";

  return `
    <defs>
      <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${skyTop}"/>
        <stop offset="1" stop-color="${skyBottom}"/>
      </linearGradient>
    </defs>
    <rect width="360" height="240" fill="url(#${id}-sky)"/>
    ${night ? `
      <g fill="#f8edc7">
        <circle cx="45" cy="35" r="2"/><circle cx="110" cy="23" r="1.5"/>
        <circle cx="182" cy="42" r="1.8"/><circle cx="307" cy="26" r="2"/>
        <path d="M286 31 a20 20 0 1 0 15 32 a16 16 0 1 1 -15 -32" fill="#f7e6b7"/>
      </g>
    ` : rain ? `
      <g fill="#dbe4e5" stroke="${INK}" stroke-width="2.5" opacity="0.94">
        <path d="M-22 61 Q-7 35 21 48 Q34 19 67 35 Q93 28 101 57 Q83 70 54 64 Q18 73 -22 61 Z"/>
        <path d="M229 50 Q242 26 268 39 Q279 15 311 31 Q339 27 352 53 Q326 66 291 59 Q262 66 229 50 Z"/>
      </g>
    ` : `
      <circle cx="54" cy="46" r="25" fill="#f4ab47" opacity="0.88"/>
      <g fill="${PAPER}" opacity="0.88">
        <ellipse cx="256" cy="50" rx="38" ry="11"/><ellipse cx="232" cy="55" rx="24" ry="9"/>
        <ellipse cx="282" cy="56" rx="25" ry="9"/>
      </g>
    `}
    ${coast
      ? `<path d="M0 130 Q90 120 180 131 T360 126 V177 H0 Z" fill="#80b9ca"/>`
      : `<path d="M0 139 Q72 92 148 132 Q220 165 285 116 Q324 91 360 124 V183 H0 Z" fill="${hill}"/>`
    }
    ${forest ? `
      <g fill="#4d765c" stroke="${INK}" stroke-width="2.3">
        <path d="M26 162 L48 96 L70 162 Z"/><path d="M286 164 L311 87 L336 164 Z"/>
        <path d="M310 164 L332 108 L354 164 Z"/>
      </g>
    ` : ""}
    <path d="M0 170 Q90 156 181 171 Q271 185 360 166 V240 H0 Z" fill="${ground}"/>
    <path d="M0 171 Q90 157 181 172 Q271 186 360 167" fill="none" stroke="${INK}" stroke-width="4"/>
  `;
}

function wrapScene(scene, art) {
  return `
    <article class="pause-animation" data-scene="${scene.id}">
      <div class="pause-animation__art">
        ${art}
        <span class="pause-animation__elapsed"><i></i> seit 18 Min.</span>
      </div>
      <div class="pause-animation__caption">
        <div class="pause-animation__pause">
          <span class="pause-animation__pause-icon" aria-hidden="true"><i></i><i></i></span>
          <span>Pause</span>
          <small>Fahrt unterbrochen</small>
        </div>
        <strong>${scene.title}</strong>
        <span>${scene.message}</span>
      </div>
    </article>
  `;
}

function boxenstopp(scene) {
  return wrapScene(scene, `
    <svg viewBox="0 0 360 240" role="img" aria-label="${scene.title}">
      ${landscape(scene.id, { forest: true })}
      ${bike({ x: 54, y: 190, color: GREEN, scale: 0.88, className: "pa-wheel-wobble" })}
      ${rider({ x: 276, y: 203, color: ORANGE, skin: "#dca477", flip: true, className: "pa-float pa-float--late" })}
      <g transform="translate(205 192)">
        <path d="M0 0 V-55" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
        <path class="pa-pump" d="M-12 -55 H12 M0 -55 V-34" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
        <rect x="-9" y="-34" width="18" height="35" rx="5" fill="#e84e3d" stroke="${INK}" stroke-width="4"/>
        <path d="M8 -4 Q26 -5 25 -22" fill="none" stroke="${INK}" stroke-width="3"/>
      </g>
      <g transform="translate(149 185)">
        <path d="M-18 0 L-9 -35 M12 0 L8 -35" stroke="#2b3a41" stroke-width="10" stroke-linecap="round"/>
        <path d="M-11 -36 Q0 -45 14 -37 L10 -69 Q0 -75 -10 -68 Z" fill="${HELLAS_BLUE}" stroke="${INK}" stroke-width="4"/>
        <path d="M-9 -49 Q1 -54 12 -49 L11 -41 Q1 -45 -10 -41 Z" fill="${PAPER}"/>
        <circle cx="2" cy="-85" r="18" fill="#e8b48c" stroke="${INK}" stroke-width="4"/>
        <path d="M-16 -91 Q2 -106 19 -89" fill="${HELLAS_BLUE}" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
        <g fill="none" stroke="${INK}" stroke-width="2">
          <rect x="-10" y="-91" width="10" height="8" rx="3"/>
          <rect x="3" y="-91" width="10" height="8" rx="3"/>
          <path d="M0 -87 H3"/>
        </g>
        <path d="M9 -63 Q24 -49 25 -26" fill="none" stroke="#e8b48c" stroke-width="8" stroke-linecap="round"/>
      </g>
      <g fill="none" stroke="${PAPER}" stroke-width="3" stroke-linecap="round">
        <path class="pa-air" d="M144 174 q9 -9 17 0"/>
        <path class="pa-air pa-air--2" d="M147 181 q7 -6 13 0"/>
      </g>
    </svg>
  `);
}

function snack(scene) {
  return wrapScene(scene, `
    <svg viewBox="0 0 360 240" role="img" aria-label="${scene.title}">
      ${landscape(scene.id, { coast: true })}
      <path d="M75 202 H290" stroke="#76583e" stroke-width="13" stroke-linecap="round"/>
      <path d="M94 202 L84 225 M270 202 L282 225" stroke="#76583e" stroke-width="7" stroke-linecap="round"/>
      ${rider({ x: 126, y: 210, color: GREEN, className: "pa-float" })}
      ${rider({ x: 238, y: 210, color: ORANGE, skin: "#dca477", flip: true, className: "pa-float pa-float--late" })}
      <g transform="translate(154 138)">
        <g class="pa-chew">
          <path d="M0 0 q13 -15 26 -2 q-7 14 -23 10 Z" fill="#f0bb3c" stroke="${INK}" stroke-width="3"/>
          <path d="M24 -2 q8 -7 12 -2" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
        </g>
      </g>
      <g transform="translate(190 184)">
        <path d="M-27 10 Q0 -28 27 10 Z" fill="#d6b173" stroke="${INK}" stroke-width="4"/>
        <path d="M-17 0 Q0 -12 17 0" fill="none" stroke="#e84e3d" stroke-width="4" stroke-dasharray="5 5"/>
      </g>
      <g fill="#d89b43" stroke="${INK}" stroke-width="1.5">
        <circle class="pa-crumb" cx="176" cy="150" r="3"/>
        <circle class="pa-crumb pa-crumb--2" cx="183" cy="145" r="2.6"/>
      </g>
      <text x="180" y="42" text-anchor="middle" fill="${INK}" font-size="13" font-weight="900" font-family="Trebuchet MS, sans-serif">Wer hat die letzte Banane?</text>
    </svg>
  `);
}

function faltkarte(scene) {
  return wrapScene(scene, `
    <svg viewBox="0 0 360 240" role="img" aria-label="${scene.title}">
      ${landscape(scene.id)}
      ${rider({ x: 84, y: 218, color: GREEN, className: "pa-float" })}
      ${rider({ x: 279, y: 218, color: ORANGE, skin: "#dca477", flip: true, className: "pa-float pa-float--late" })}
      <g transform="translate(180 142)">
        <g class="pa-map">
          <path d="M-72 -39 L-25 -47 L23 -38 L70 -48 V42 L24 51 L-24 42 L-72 50 Z"
            fill="#f6e4ad" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
          <path d="M-25 -47 L-24 42 M23 -38 L24 51" stroke="${INK}" stroke-width="2.5"/>
          <path d="M-58 16 Q-37 -15 -7 8 T48 -1" fill="none" stroke="#e84e3d" stroke-width="4" stroke-linecap="round" stroke-dasharray="6 5"/>
          <circle cx="47" cy="-3" r="6" fill="${GREEN}" stroke="${INK}" stroke-width="2"/>
        </g>
      </g>
      <g transform="translate(135 59)">
        <g class="pa-cap">
          <path d="M-15 0 Q0 -15 16 0 L13 7 H-13 Z" fill="${HELLAS_BLUE}" stroke="${INK}" stroke-width="3"/>
          <path d="M12 5 q15 -2 18 4" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
        </g>
      </g>
      <g fill="none" stroke="${PAPER}" stroke-width="4" stroke-linecap="round">
        <path class="pa-wind" d="M14 75 h42 q14 0 14 -9"/>
        <path class="pa-wind pa-wind--2" d="M274 102 h42"/>
      </g>
    </svg>
  `);
}

function regenschirm(scene) {
  return wrapScene(scene, `
    <svg viewBox="0 0 360 240" role="img" aria-label="${scene.title}">
      ${landscape(scene.id, { rain: true })}
      <g opacity="0.62">
        ${bike({ x: 24, y: 185, color: GREEN, scale: 0.5, flat: true })}
        ${bike({ x: 282, y: 187, color: ORANGE, scale: 0.48, flat: true })}
      </g>
      <g fill="none" stroke="#7195a7" stroke-width="3" stroke-linecap="round" opacity="0.78">
        <g class="pa-rain">
          <path d="M20 8 l-11 28 M70 -8 l-11 28 M120 12 l-11 28 M175 -10 l-11 28 M230 5 l-11 28 M292 -12 l-11 28 M345 6 l-11 28"/>
        </g>
        <g transform="translate(0 53)">
          <g class="pa-rain pa-rain--2">
            <path d="M40 0 l-11 28 M93 -7 l-11 28 M147 5 l-11 28 M206 -9 l-11 28 M260 7 l-11 28 M327 -6 l-11 28"/>
          </g>
        </g>
      </g>
      ${rider({ x: 148, y: 220, color: GREEN, className: "pa-float" })}
      ${rider({ x: 214, y: 220, color: ORANGE, skin: "#dca477", flip: true, className: "pa-float pa-float--late" })}
      <g transform="translate(180 101)">
        <g class="pa-umbrella">
          <path d="M0 7 V110 q0 17 15 10" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
          <path d="M-94 7 Q-70 -45 0 -48 Q70 -45 94 7 Q70 -5 47 7 Q23 -5 0 7 Q-23 -5 -47 7 Q-70 -5 -94 7 Z"
            fill="#e84e3d" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
          <path d="M0 -47 V7" stroke="${INK}" stroke-width="3"/>
          <path d="M-47 7 Q-38 -27 0 -48 Q38 -27 47 7" fill="#f06450" opacity="0.52"/>
        </g>
      </g>
      <ellipse cx="181" cy="228" rx="57" ry="8" fill="#6d9cab" opacity="0.72"/>
      <ellipse class="pa-puddle" cx="87" cy="220" rx="20" ry="4" fill="none" stroke="#d8edf0" stroke-width="3"/>
      <g fill="none" stroke="#d8edf0" stroke-width="2" opacity="0.8">
        <ellipse cx="295" cy="219" rx="29" ry="5"/><ellipse cx="54" cy="227" rx="23" ry="4"/>
      </g>
    </svg>
  `);
}

function sonnencreme(scene) {
  return wrapScene(scene, `
    <svg viewBox="0 0 360 240" role="img" aria-label="${scene.title}">
      ${landscape(scene.id, { coast: true })}
      <g transform="translate(54 46)">
        <g class="pa-sun-rays" stroke="#f4ab47" stroke-width="4" stroke-linecap="round">
          <path d="M0 -36 V-47 M0 36 V47 M-36 0 H-47 M36 0 H47 M-26 -26 L-34 -34 M26 26 L34 34 M26 -26 L34 -34 M-26 26 L-34 34"/>
        </g>
      </g>
      ${rider({ x: 114, y: 216, color: GREEN, className: "pa-float" })}
      ${rider({ x: 256, y: 216, color: ORANGE, skin: "#dca477", flip: true, className: "pa-float pa-float--late" })}
      <g transform="translate(202 135) rotate(-12)">
        <g class="pa-bottle">
          <rect x="-11" y="-25" width="22" height="43" rx="7" fill="#f6e26c" stroke="${INK}" stroke-width="4"/>
          <rect x="-7" y="-33" width="14" height="10" rx="3" fill="${PAPER}" stroke="${INK}" stroke-width="3"/>
          <circle cx="0" cy="-4" r="6" fill="#e84e3d"/>
        </g>
      </g>
      <g class="pa-cream">
        <path d="M201 103 Q194 86 181 90 Q172 94 166 86" fill="none" stroke="${PAPER}" stroke-width="6" stroke-linecap="round"/>
        <circle cx="166" cy="86" r="6" fill="${PAPER}" stroke="${INK}" stroke-width="2"/>
      </g>
      <path d="M90 115 Q114 101 138 115" fill="none" stroke="#f7f2df" stroke-width="7" stroke-linecap="round" opacity="0.95"/>
      <text x="225" y="44" text-anchor="middle" fill="${INK}" font-size="13" font-weight="900" font-family="Trebuchet MS, sans-serif">Lichtschutzfaktor: sehr großzügig.</text>
    </svg>
  `);
}

function haengematte(scene) {
  return wrapScene(scene, `
    <svg viewBox="0 0 360 240" role="img" aria-label="${scene.title}">
      ${landscape(scene.id, { forest: true })}
      <g stroke="#76583e" stroke-width="14" stroke-linecap="round">
        <path d="M52 228 Q58 139 65 90"/><path d="M308 228 Q302 139 295 90"/>
      </g>
      <g fill="#4d765c" stroke="${INK}" stroke-width="3">
        <circle cx="56" cy="81" r="31"/><circle cx="76" cy="70" r="25"/>
        <circle cx="303" cy="78" r="32"/><circle cx="283" cy="68" r="24"/>
      </g>
      <g opacity="0.5">
        ${bike({ x: 238, y: 208, color: ORANGE, scale: 0.46, flat: true })}
      </g>
      <g class="pa-hammock">
        <path d="M68 124 Q180 225 292 124 Q235 200 180 205 Q125 200 68 124 Z" fill="#e84e3d" stroke="${INK}" stroke-width="4"/>
        <path d="M79 132 Q180 210 281 132" fill="none" stroke="#f5d06f" stroke-width="5" stroke-dasharray="13 8"/>
        <g transform="translate(176 176) rotate(4)">
          <circle cx="-42" cy="-5" r="17" fill="#e8b48c" stroke="${INK}" stroke-width="4"/>
          <path d="M-58 -11 Q-42 -27 -25 -11" fill="${HELLAS_BLUE}" stroke="${INK}" stroke-width="4"/>
          <g fill="none" stroke="${INK}" stroke-width="2">
            <rect x="-53" y="-10" width="9" height="7" rx="3"/>
            <rect x="-41" y="-10" width="9" height="7" rx="3"/>
            <path d="M-44 -7 H-41"/>
          </g>
          <path d="M-26 -1 Q15 12 52 -3" fill="none" stroke="${HELLAS_BLUE}" stroke-width="22" stroke-linecap="round"/>
          <path d="M-5 5 Q13 10 30 4" fill="none" stroke="${PAPER}" stroke-width="7" stroke-linecap="round"/>
          <path d="M35 -4 q25 -8 36 -22" fill="none" stroke="#2b3a41" stroke-width="12" stroke-linecap="round"/>
        </g>
      </g>
      <g transform="translate(289 209)">
        <path d="M-12 0 L-5 -20 M13 0 L7 -20" stroke="#2b3a41" stroke-width="9" stroke-linecap="round"/>
        <path d="M-14 -20 Q0 -28 15 -20 L11 -53 Q0 -61 -11 -52 Z" fill="${HELLAS_BLUE}" stroke="${INK}" stroke-width="3.5"/>
        <path d="M-12 -35 Q0 -39 13 -35 L12 -28 Q0 -31 -12 -28 Z" fill="${PAPER}"/>
        <circle cx="0" cy="-68" r="16" fill="#dca477" stroke="${INK}" stroke-width="3.5"/>
        <path d="M-15 -72 Q0 -87 16 -71" fill="${HELLAS_BLUE}" stroke="${INK}" stroke-width="4"/>
        <path d="M-12 -72 Q-8 -82 -3 -84 L-1 -72 Z M12 -72 Q8 -82 3 -84 L1 -72 Z" fill="${PAPER}"/>
        <path d="M-9 -66 q9 -4 18 0" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>
      </g>
      <g fill="${PAPER}" stroke="${INK}" stroke-width="1.5" font-family="Trebuchet MS, sans-serif" font-weight="900">
        <text class="pa-zzz" x="225" y="119" font-size="13">Z</text>
        <text class="pa-zzz pa-zzz--2" x="238" y="102" font-size="17">Z</text>
        <text class="pa-zzz pa-zzz--3" x="253" y="83" font-size="21">Z</text>
      </g>
      <g transform="translate(92 105)">
        <g class="pa-fly">
          <circle r="3" fill="${INK}"/><ellipse cx="-4" cy="-3" rx="4" ry="2" fill="${PAPER}"/><ellipse cx="4" cy="-3" rx="4" ry="2" fill="${PAPER}"/>
        </g>
      </g>
    </svg>
  `);
}

function kettenop(scene) {
  return wrapScene(scene, `
    <svg viewBox="0 0 360 240" role="img" aria-label="${scene.title}">
      ${landscape(scene.id, { night: true, forest: true })}
      <path class="pa-headlamp" d="M112 115 L268 162 L108 137 Z" fill="#f8e9a8" opacity="0.4"/>
      ${bike({ x: 142, y: 193, color: ORANGE, scale: 0.8, flat: true })}
      ${rider({ x: 92, y: 215, color: GREEN, className: "pa-float" })}
      <g transform="translate(264 213)">
        <path d="M-17 0 L-10 -35 M14 0 L9 -35" stroke="#2b3a41" stroke-width="10" stroke-linecap="round"/>
        <path d="M-12 -36 Q0 -49 15 -37 L11 -69 Q0 -77 -11 -68 Z" fill="${HELLAS_BLUE}" stroke="${INK}" stroke-width="4"/>
        <path d="M-10 -50 Q1 -55 13 -50 L12 -42 Q1 -46 -11 -42 Z" fill="${PAPER}"/>
        <circle cx="1" cy="-85" r="18" fill="#dca477" stroke="${INK}" stroke-width="4"/>
        <path d="M-16 -90 Q1 -106 18 -89" fill="${HELLAS_BLUE}" stroke="${INK}" stroke-width="4"/>
        <path d="M-13 -93 Q-10 -101 -4 -103 L-2 -93 Z M15 -92 Q11 -101 5 -103 L3 -93 Z" fill="${PAPER}"/>
        <circle cx="-2" cy="-91" r="4" fill="#f6d35c" stroke="${INK}" stroke-width="2"/>
        <path d="M-7 -65 Q-28 -48 -35 -24" fill="none" stroke="#dca477" stroke-width="8" stroke-linecap="round"/>
      </g>
      <g transform="translate(225 181) rotate(-20)">
        <g class="pa-wrench">
          <path d="M0 0 V-30 M-7 -37 Q0 -29 7 -37" fill="none" stroke="#c2cbcf" stroke-width="6" stroke-linecap="round"/>
        </g>
      </g>
      <g fill="#f4d65e">
        <circle class="pa-firefly" cx="55" cy="72" r="3"/>
        <circle class="pa-firefly pa-firefly--2" cx="303" cy="103" r="3"/>
        <circle class="pa-firefly pa-firefly--3" cx="185" cy="61" r="2.7"/>
      </g>
      <g stroke="#f6df69" stroke-width="3" stroke-linecap="round">
        <path class="pa-spark" d="M210 174 l-8 -8 M210 174 l10 -6"/>
        <path class="pa-spark pa-spark--2" d="M210 174 v-12"/>
      </g>
      <text x="180" y="39" text-anchor="middle" fill="#f8edc7" font-size="13" font-weight="900" font-family="Trebuchet MS, sans-serif">Operation Kettenglied läuft.</text>
    </svg>
  `);
}

const scenes = [
  {
    id: "boxenstopp",
    title: "Boxenstopp ohne Box",
    message: "Einmal Luft, Kette und heldenhaftes Nicken.",
    description: "Funktioniert fast überall und ist der universelle Fahrrad-Pausenwitz.",
    weather: ["sunny", "cloudy"],
    time: ["morning", "midday", "afternoon", "evening"],
    terrain: ["open", "forest", "mountain"],
    temperature: [8, 33],
    tags: ["Panne", "Fahrrad", "universell"],
    render: boxenstopp,
  },
  {
    id: "snack",
    title: "Snack-Schmuggel",
    message: "Die letzte Banane wechselt unter ungeklärten Umständen den Besitzer.",
    description: "Eine gute neutrale Überraschung für Orte, Küste und normale Tagespausen.",
    weather: ["sunny", "cloudy"],
    time: ["morning", "midday", "afternoon"],
    terrain: ["village", "coast", "open"],
    temperature: [10, 36],
    tags: ["Essen", "Küste", "Mittag"],
    render: snack,
  },
  {
    id: "faltkarte",
    title: "Kampf mit der Faltkarte",
    message: "Die Route ist klar. Nur die Karte sieht das anders.",
    description: "Besonders passend bei Wind, auf freier Fläche oder in den Bergen.",
    weather: ["wind"],
    time: ["morning", "midday", "afternoon", "evening"],
    terrain: ["open", "mountain", "coast"],
    temperature: [5, 34],
    tags: ["Wind", "Navigation", "Berge"],
    render: faltkarte,
  },
  {
    id: "regenschirm",
    title: "Zwei Fahrer, ein Schirm",
    message: "Trocken bleiben sie – nur noch nicht gleichzeitig.",
    featured: true,
    description: "Der klare Wetter-Gag für Regen oder ein plötzliches Sommergewitter.",
    weather: ["rain"],
    time: ["morning", "midday", "afternoon", "evening"],
    terrain: ["village", "open", "forest", "mountain", "coast"],
    temperature: [4, 30],
    tags: ["Regen", "Wetter", "Teamwork"],
    render: regenschirm,
  },
  {
    id: "sonnencreme",
    title: "Sonnencreme-Unfall",
    message: "Lichtschutzfaktor 50. Treffsicherheit eher 12.",
    description: "Wird bei Sonne, Hitze und besonders an der Küste wahrscheinlich.",
    weather: ["sunny"],
    time: ["midday", "afternoon"],
    terrain: ["open", "mountain", "coast"],
    temperature: [23, 40],
    tags: ["Sonne", "Hitze", "Küste"],
    render: sonnencreme,
  },
  {
    id: "haengematte",
    title: "Tour de Siesta",
    message: "Die Beine fahren später weiter. Angeblich.",
    featured: true,
    description: "Ideal für heiße Nachmittage im Wald oder an einem ruhigen Rastplatz.",
    weather: ["sunny", "cloudy"],
    time: ["midday", "afternoon"],
    terrain: ["forest", "open", "coast"],
    temperature: [22, 40],
    tags: ["Siesta", "Hitze", "Wald"],
    render: haengematte,
  },
  {
    id: "kettenop",
    title: "Nächtliche Ketten-OP",
    message: "Stirnlampe an. Fachwissen wird spontan erfunden.",
    description: "Ein seltener Sonderfall für Abend und Nacht, möglichst abseits eines Orts.",
    weather: ["cloudy", "sunny"],
    time: ["evening", "night"],
    terrain: ["forest", "open", "mountain"],
    temperature: [4, 28],
    tags: ["Nacht", "Panne", "Stirnlampe"],
    render: kettenop,
  },
];

const elements = {
  weather: document.querySelector("#weather"),
  time: document.querySelector("#time"),
  terrain: document.querySelector("#terrain"),
  temperature: document.querySelector("#temperature"),
  temperatureValue: document.querySelector("#temperatureValue"),
  randomButton: document.querySelector("#randomButton"),
  selectedAnimation: document.querySelector("#selectedAnimation"),
  selectedTitle: document.querySelector("#selected-title"),
  selectedMessage: document.querySelector("#selectedMessage"),
  selectedReason: document.querySelector("#selectedReason"),
  selectedTags: document.querySelector("#selectedTags"),
  animationGrid: document.querySelector("#animationGrid"),
};

let selectedSceneId = null;

function currentContext() {
  return {
    weather: elements.weather.value,
    time: elements.time.value,
    terrain: elements.terrain.value,
    temperature: Number(elements.temperature.value),
  };
}

function scoreScene(scene, context) {
  let score = 1;
  if (scene.weather.includes(context.weather)) score += context.weather === "rain" || context.weather === "wind" ? 8 : 4;
  if (scene.time.includes(context.time)) score += 4;
  if (scene.terrain.includes(context.terrain)) score += 2.5;
  if (context.temperature >= scene.temperature[0] && context.temperature <= scene.temperature[1]) score += 2;

  if (scene.id === "sonnencreme" && context.temperature >= 28) score += 5;
  if (scene.id === "haengematte" && context.temperature >= 26) score += 4;
  if (scene.id === "kettenop" && context.time === "night") score += 10;
  if (scene.id === "regenschirm" && context.weather !== "rain") score *= 0.12;
  if (scene.id === "faltkarte" && context.weather !== "wind") score *= 0.42;
  if (scene.id === "kettenop" && !["evening", "night"].includes(context.time)) score *= 0.08;
  if (scene.id === "sonnencreme" && (context.weather !== "sunny" || context.temperature < 20)) score *= 0.12;

  return Math.max(score, 0.05);
}

function chooseWeightedScene(context) {
  const ranked = scenes
    .map((scene) => ({ scene, score: scoreScene(scene, context) }))
    .sort((a, b) => b.score - a.score);

  const bestScore = ranked[0].score;
  const candidates = ranked.filter((item) => item.score >= bestScore * 0.48);
  const total = candidates.reduce((sum, item) => sum + item.score, 0);
  let draw = Math.random() * total;

  for (const item of candidates) {
    draw -= item.score;
    if (draw <= 0) return item.scene;
  }

  return candidates[0].scene;
}

function reasonFor(scene, context) {
  const reasons = [];
  if (scene.weather.includes(context.weather)) reasons.push(`passt zu ${contextLabels.weather[context.weather]}`);
  if (scene.time.includes(context.time)) reasons.push(`funktioniert ${contextLabels.time[context.time]}`);
  if (scene.terrain.includes(context.terrain)) reasons.push(`passt ${contextLabels.terrain[context.terrain]}`);
  if (scene.id === "sonnencreme" && context.temperature >= 28) reasons.push(`${context.temperature} °C machen Sonnencreme sehr plausibel`);
  else if (scene.id === "haengematte" && context.temperature >= 26) reasons.push(`${context.temperature} °C sprechen für Siesta`);
  else if (context.temperature >= scene.temperature[0] && context.temperature <= scene.temperature[1]) reasons.push(`Temperatur liegt im passenden Bereich`);

  return reasons.length
    ? `Warum diese? ${reasons.join(", ")}. Die Auswahl bleibt innerhalb der passenden Kandidaten zufällig.`
    : `Diese Szene ist als seltene Überraschung im universellen Rest-Topf gelandet.`;
}

function renderSelected(scene, { scroll = false } = {}) {
  const context = currentContext();
  selectedSceneId = scene.id;
  elements.selectedAnimation.innerHTML = scene.render(scene);
  elements.selectedTitle.textContent = scene.title;
  elements.selectedMessage.textContent = `„${scene.message}“`;
  elements.selectedReason.textContent = reasonFor(scene, context);
  elements.selectedTags.innerHTML = scene.tags.map((tag) => `<span class="context-tag">${tag}</span>`).join("");

  document.querySelectorAll(".animation-card").forEach((card) => {
    card.classList.toggle("is-selected", card.dataset.sceneId === scene.id);
  });

  if (scroll) {
    document.querySelector(".selected-panel").scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function renderGallery() {
  const favoriteOrder = ["haengematte", "regenschirm"];
  const galleryScenes = [...scenes].sort((a, b) => {
    const aIndex = favoriteOrder.indexOf(a.id);
    const bIndex = favoriteOrder.indexOf(b.id);
    if (aIndex !== -1 || bIndex !== -1) {
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    }
    return 0;
  });

  elements.animationGrid.innerHTML = galleryScenes.map((scene) => `
    <button class="animation-card${scene.featured ? " animation-card--featured" : ""}" type="button" data-scene-id="${scene.id}" aria-label="${scene.title} groß anzeigen">
      ${scene.featured ? `<span class="animation-card__flag">Favorit</span>` : ""}
      ${scene.render(scene)}
    </button>
  `).join("");

  elements.animationGrid.addEventListener("click", (event) => {
    const card = event.target.closest(".animation-card");
    if (!card) return;
    const scene = scenes.find((candidate) => candidate.id === card.dataset.sceneId);
    if (scene) renderSelected(scene, { scroll: true });
  });
}

function drawNewScene() {
  const scene = chooseWeightedScene(currentContext());
  renderSelected(scene);
  elements.randomButton.classList.remove("is-spinning");
  requestAnimationFrame(() => elements.randomButton.classList.add("is-spinning"));
}

function handleContextChange() {
  elements.temperatureValue.textContent = elements.temperature.value;
  if (selectedSceneId) {
    const selectedScene = scenes.find((scene) => scene.id === selectedSceneId);
    elements.selectedReason.textContent = reasonFor(selectedScene, currentContext());
  }
}

renderGallery();
elements.randomButton.addEventListener("click", drawNewScene);
[elements.weather, elements.time, elements.terrain, elements.temperature].forEach((control) => {
  control.addEventListener("input", handleContextChange);
  control.addEventListener("change", handleContextChange);
});

renderSelected(scenes.find((scene) => scene.id === "haengematte"));
