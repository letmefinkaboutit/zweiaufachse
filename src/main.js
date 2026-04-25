import { createApp } from "./app/app.js";

const root = document.querySelector("#app");

if (!root) {
  throw new Error("App root #app wurde nicht gefunden.");
}

createApp(root).catch((error) => {
  root.innerHTML = `
    <div class="app-shell">
      <section class="route-loading-card">
        <p class="section-intro__eyebrow">App-Fehler</p>
        <h2>Die Web-App konnte nicht korrekt starten.</h2>
        <p class="muted-text">${error instanceof Error ? error.message : "Unbekannter Fehler"}</p>
      </section>
    </div>
  `;
  console.error(error);
});
