export function createShell() {
  return `
    <div class="app-shell">
      <header class="app-header">
        <div class="brand-chip">Zweiradchaos</div>
        <div>
          <p class="app-header__eyebrow">Reisebegleitung fuer Familie & Freunde</p>
          <h1>Timo & Tino on Tour</h1>
        </div>
      </header>

      <main class="app-main" data-app-content></main>

      <nav class="bottom-nav" aria-label="Hauptnavigation" data-app-nav></nav>
    </div>
  `;
}
