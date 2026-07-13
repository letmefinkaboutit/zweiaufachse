export const routeSource = {
  // Original-GPX (Quelle der Wahrheit). Die App laedt das daraus generierte
  // kompakte JSON — nach Routenaenderung: node tools/build-route-data.mjs
  filePath: "./src/route/Schorndorf - Kritharia Alternative.gpx",
  dataPath: "./src/route/route-data.json",
  currentProgressRatio: 0,
  currentProgressLabel: "Plan-/Mock-Fortschritt fuer das MVP",
  currentLocationLabel: "Startpunkt Schorndorf, Deutschland",
  progressStory:
    "Die Route ist bereits echt aus der GPX-Datei gelesen. Die Live-Position wird jetzt ueber einen Provider auf die Route gelegt.",
};
