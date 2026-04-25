import { settingsPreview } from "../data/mockData.js";
import { createSectionIntro } from "../utils/format.js";
import { createInfoCard } from "../components/cards.js";

export function renderSettingsPage() {
  return `
    <div class="page-stack">
      ${createSectionIntro(
        "Einstellungen & Admin-Vorbereitung",
        "Noch kein Admin-Panel, aber eine solide Basis",
        "Dieses Modul zeigt, wie Inhalte spaeter gepflegt, erweitert und an echte Datenquellen angebunden werden koennen.",
      )}

      <section class="card-grid">
        ${createInfoCard({
          title: "Modulsteuerung",
          value: "Zentrale Konfiguration",
          detail: settingsPreview.modulesConfig,
        })}
        ${createInfoCard({
          title: "Datenhaltung",
          value: "Mockdaten an einer Stelle",
          detail: settingsPreview.dataSource,
        })}
        ${createInfoCard({
          title: "Naechster Ausbau",
          value: "Admin-Vorbereitung",
          detail: settingsPreview.nextAdminStep,
        })}
      </section>
    </div>
  `;
}
