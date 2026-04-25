export function createSectionIntro(eyebrow, title, text) {
  return `
    <section class="section-intro">
      <p class="section-intro__eyebrow">${eyebrow}</p>
      <h2>${title}</h2>
      <p class="section-intro__text">${text}</p>
    </section>
  `;
}

export function createTag(label, tone = "neutral") {
  return `<span class="tag tag--${tone}">${label}</span>`;
}
