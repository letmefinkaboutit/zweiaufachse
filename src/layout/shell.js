export function createShell() {
  return `
    <div class="app-shell">
      <main class="app-main" data-app-content></main>
    </div>
    <dialog id="photo-lightbox" class="photo-lightbox">
      <button class="photo-lightbox__close" data-lightbox-close aria-label="Schliessen">&#x2715;</button>
      <img class="photo-lightbox__img" src="" alt="" />
      <p class="photo-lightbox__caption"></p>
    </dialog>
  `;
}
