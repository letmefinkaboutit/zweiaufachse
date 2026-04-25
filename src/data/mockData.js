export const tripMeta = {
  title: "Timo & Tino on Tour",
  subtitle: "Von Schorndorf bis Griechenland",
  start: "Schorndorf, Deutschland",
  destination: "Griechenland",
  todayLabel: "Tag 12 auf Tour",
  currentLocation: "Nahe Mostar, Bosnien und Herzegowina",
  currentStatus: "unterwegs",
  dailyBrief:
    "Heute lief es ueberraschend rund: Sonne, wenig Gegenwind und nur eine kurze Schrauberpause am Gepaecktraeger.",
};

export const dashboardHighlights = [
  {
    title: "Aktueller Reisestatus",
    value: "Locker unterwegs",
    detail: "Seit dem Morgen auf einer langen Tal-Etappe Richtung Sueden.",
  },
  {
    title: "Tageskurzinfo",
    value: "87 km geplant",
    detail: "Mittagsstopp mit Boerek und starkem Kaffee.",
  },
  {
    title: "Naechster Meilenstein",
    value: "Grenze in Sicht",
    detail: "Wenn alles gut laeuft, ist morgen das naechste Land dran.",
  },
];

export const routeMock = {
  startPoint: "Schorndorf, Deutschland",
  targetPoint: "Westgriechenland",
  currentPosition: "Nahe Mostar",
  completion: 48,
  mapNote: "Hier entsteht spaeter eine Karte mit Live- oder Tagespositionen.",
  stages: [
    { day: "Tag 1", from: "Schorndorf", to: "Ulm", distance: "92 km", note: "Eingerollt mit viel Euphorie." },
    { day: "Tag 4", from: "Muenchen", to: "Salzburg", distance: "118 km", note: "Erste lange Alpen-Vibes." },
    { day: "Tag 8", from: "Ljubljana", to: "Rijeka", distance: "104 km", note: "Kuestenluft erstmals geschnuppert." },
    { day: "Tag 12", from: "Dubrovnik", to: "Mostar-Region", distance: "87 km", note: "Waermer, trockener, spektakulaerer." },
  ],
};

export const updates = [
  {
    id: "u1",
    category: "Etappe",
    date: "25.04.2026",
    title: "Heute viele Kilometer, wenig Drama",
    text: "Timo und Tino haben einen ruhigen Fahrtag erwischt. Der Asphalt war freundlich, die Beine erstaunlich auch.",
    hasImage: true,
  },
  {
    id: "u2",
    category: "Panne",
    date: "24.04.2026",
    title: "Kurzer Halt wegen klapperndem Gepaecktraeger",
    text: "Zum Glueck nichts Wildes. Zwei Schrauben nachgezogen, einmal geschnauft, weiter ging es.",
    hasImage: false,
  },
  {
    id: "u3",
    category: "Essen",
    date: "24.04.2026",
    title: "Bester Snack des Tages",
    text: "Boerek plus Joghurt. Offiziell als Leistungstreibstoff eingestuft.",
    hasImage: true,
  },
  {
    id: "u4",
    category: "Ruhetag",
    date: "22.04.2026",
    title: "Halber Tag Pause",
    text: "Waesche, Kartencheck, Kaffee und ein bisschen in die Gegend schauen. Sehr professionelles Recovery-Programm.",
    hasImage: false,
  },
  {
    id: "u5",
    category: "Highlight",
    date: "21.04.2026",
    title: "Abendlicht am Wasser",
    text: "Zum Sonnenuntergang sah selbst die muede Kette ploetzlich romantisch aus.",
    hasImage: true,
  },
];

export const stats = [
  { label: "Gefahrene Kilometer", value: "1.146 km", tone: "primary" },
  { label: "Hoehenmeter", value: "9.820 hm", tone: "primary" },
  { label: "Tage unterwegs", value: "12", tone: "primary" },
  { label: "Verbleibende Strecke", value: "1.240 km", tone: "calm" },
  { label: "Durchschnitt pro Tag", value: "95,5 km", tone: "calm" },
  { label: "Vermutlich getrunkene Biere", value: "23", tone: "fun" },
  { label: "Gegessene Gyros", value: "3 in Gedanken", tone: "fun" },
  { label: "Sonnenbrand-Level", value: "Orange", tone: "fun" },
];

export const galleryItems = [
  { id: "g1", title: "Morgenstart", type: "Bild", caption: "Noch alle motiviert." },
  { id: "g2", title: "Snackpause", type: "Bild", caption: "Kaffeezaehler steigt." },
  { id: "g3", title: "Kurzes Video", type: "Video", caption: "Windtest auf offener Strasse." },
  { id: "g4", title: "Abendlicht", type: "Bild", caption: "Tourkitsch vom Feinsten." },
  { id: "g5", title: "Werkzeugmoment", type: "Bild", caption: "Fahrradchirurgie am Seitenstreifen." },
  { id: "g6", title: "Campingplatz", type: "Bild", caption: "Zelt, Pasta, Erschoepfung." },
];

export const riderProfiles = [
  {
    name: "Timo",
    nickname: "Captain Rueckenwind",
    role: "Routeninstinkt und Snack-Scout",
    description: "Faehrt meistens ruhig los und ist dann ploetzlich ganz vorn. Hat ein Auge fuer gute Pausenplaetze.",
    strengths: ["Nervenstark", "Findet Kaffee", "Motiviert bergab und bergauf"],
    weaknesses: ["Unterschaetzt Sonnencreme", "Sagt bei Gegenwind gern philosophische Dinge"],
  },
  {
    name: "Tino",
    nickname: "Sir Kettenoel",
    role: "Technikchef und Launenretter",
    description: "Wenn etwas klappert, schaut Tino hin. Wenn etwas absurd wird, macht er meist einen Witz daraus.",
    strengths: ["Schrauben", "Improvisieren", "Stimmung halten"],
    weaknesses: ["Kann an Baeckereien schwer vorbeifahren", "Traut Abkuerzungen etwas zu oft"],
  },
];

export const liveStatus = {
  headline: "unterwegs",
  summary: "Die beiden fahren heute eine laengere Etappe mit geplanter Pause am fruehen Nachmittag.",
  cards: [
    { label: "Energielevel", value: "stabil mit Kaffeeschwung" },
    { label: "Wetterlage", value: "warm, freundlich, etwas Wind" },
    { label: "Meldung", value: "Keine ernsten Pannen. Nur uebliches Reisechaos." },
  ],
  possibleStates: ["unterwegs", "Pause", "angekommen", "Ruhetag", "verloren irgendwo am Balkan"],
};

export const stories = {
  runningGags: [
    "Jede Schraube hat Gefuehle.",
    "Kaffee zaehlt als Navigation.",
    "Gyros ist kein Ziel, sondern ein Zustand.",
  ],
  dailyAward: {
    title: "Tagesaward",
    winner: "Der Gepaecktraeger",
    reason: "Hat trotz dramatischer Geraeuschkulisse tapfer durchgehalten.",
  },
  storyCards: [
    {
      title: "Die Legende vom magischen Kiosk",
      text: "Aus dem Nichts erschien ein Kiosk mit kalten Getraenken, genau als die Stimmung leicht ins Schwitzen geriet.",
    },
    {
      title: "Challenge-Idee fuer spaeter",
      text: "Familie stimmt ab, ob der naechste Pausenstopp nach Aussicht, Schatten oder Snackqualitaet ausgewaehlt wird.",
    },
  ],
};

export const homeInfo = {
  intro:
    "Diese Seite begleitet die Reise von Timo und Tino. Hier sieht man schnell, wo sie gerade sind, was heute passiert ist und wie weit es noch ist.",
  followSteps: [
    "Auf der Startseite gibt es den schnellsten Ueberblick.",
    "Unter Tagesupdates stehen neue Geschichten und kleine Ereignisse.",
    "In Route und Statistik sieht man den Reisefortschritt.",
  ],
  notes: [
    "Alle Daten sind im MVP noch Platzhalter oder Mockdaten.",
    "Spaeter koennen echte GPS-, Foto- oder Statusdaten eingebunden werden.",
    "Bei Fragen oder Hinweisen kann hier spaeter ein Kontaktbereich ergaenzt werden.",
  ],
};

export const settingsPreview = {
  modulesConfig:
    "Module werden zentral in src/config/modules.js gepflegt und koennen spaeter sortiert oder deaktiviert werden.",
  dataSource:
    "Mockdaten liegen gebuendelt in src/data/mockData.js und sind so vorbereitet, dass spaeter API-Daten eingespeist werden koennen.",
  nextAdminStep:
    "Ein spaeteres Admin-Panel kann auf dieselben Datenmodelle und Moduldefinitionen aufsetzen.",
};
