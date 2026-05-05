const PHOTO_API_URL = 'https://zweiaufachse.thefinks.de/bilderupload/list.php';
const POLL_INTERVAL_MS = 10 * 60 * 1000;

export function startPhotoService({ onUpdate, onError }) {
  async function poll() {
    try {
      const res = await fetch(PHOTO_API_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const photos = await res.json();
      onUpdate(photos);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Fotos konnten nicht geladen werden.');
    }
  }

  poll();
  const id = setInterval(poll, POLL_INTERVAL_MS);
  return { stop: () => clearInterval(id) };
}
