// Sehr kleine, anonyme Reichweitenmessung. Gegenstueck: api/track.php.
//
// Keine Cookies, kein localStorage, keine IDs im Browser — es wird nur ein
// Signal geschickt, der Server zaehlt es zusammen. Faellt das aus, merkt die
// App nichts davon: Messen darf die Anwendung nie stoeren.

const TRACK_URL = "https://zweiaufachse.thefinks.de/api/track.php";

function send(payload) {
  try {
    const body = JSON.stringify(payload);

    // Bewusst text/plain: damit bleibt es eine "einfache" Anfrage und der
    // Browser schickt keinen Vorab-Check (der bei sendBeacon nur Aerger macht).
    // PHP liest den Rumpf ohnehin unabhaengig vom Inhaltstyp.
    const blob = new Blob([body], { type: "text/plain;charset=UTF-8" });

    if (navigator.sendBeacon?.(TRACK_URL, blob)) return;

    fetch(TRACK_URL, { method: "POST", body, keepalive: true }).catch(() => {});
  } catch {
    // Messen ist nie wichtig genug, um irgendetwas kaputtgehen zu lassen.
  }
}

export function trackPageview(surface) {
  send({ type: "pageview", surface, ref: document.referrer || "" });
}

export function trackEvent(name, surface) {
  send({ type: "event", name, surface });
}
