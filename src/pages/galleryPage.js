import { galleryItems } from "../data/mockData.js";
import { createSectionIntro } from "../utils/format.js";
import { createGalleryCard } from "../components/cards.js";

export function renderGalleryPage() {
  return `
    <div class="page-stack">
      ${createSectionIntro(
        "Galerie",
        "Bilder und Videos als spaeteres Reisearchiv",
        "Im MVP ist die Galerie noch lokal und mockbasiert. Die Grid-Struktur ist fuer spaetere Uploads oder externe Quellen vorbereitet.",
      )}

      <section class="gallery-grid">
        ${galleryItems.map((item) => createGalleryCard(item)).join("")}
      </section>
    </div>
  `;
}
