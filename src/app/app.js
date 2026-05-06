import { createShell } from "../layout/shell.js";
import { createRouter } from "./router.js";
import { moduleRegistry } from "../config/modules.js";
import { loadRouteData } from "../services/gpxRouteService.js";
import { createLocationProvider } from "../location/LocationProvider.js";
import { mapLocationToRoute } from "../services/routePositionService.js";
import { createDefaultPoiFilters, filterPois, loadPoiData } from "../services/poiService.js";
import { reverseGeocode, geocodeOnce } from "../services/geocodeService.js";
import { buildCountrySegments } from "../services/routeCountryService.js";
import { loadHistory, appendToHistory, computeDailyStats } from "../services/locationHistoryService.js";
import { mountMapObserver, updateLiveMap } from "../services/liveMapService.js";
import { startPhotoService } from "../services/photoService.js";
import { mountPhotoMapObserver } from "../services/photoMapService.js";
import { mountPhotoTileObserver, updatePhotoTile } from "../components/cards.js";

export async function createApp(root) {
  const router = createRouter(moduleRegistry);
  const state = {
    routeData: null,
    routeError: null,
    routeLoading: true,
    locationData: null,
    previousLocationData: null,
    geocodeData: null,
    countrySegments: null,
    locationHistory: loadHistory(),
    dailyStats: { todayKm: null, yesterdayKm: null },
    locationError: null,
    locationLoading: true,
    locationProviderType: null,
    poiData: null,
    poiError: null,
    poiLoading: true,
    poiFilters: createDefaultPoiFilters(),
    overpassPois: null,
    overpassUnavailable: false,
    photoData: [],
    photoLoading: true,
    photoError: null,
    galleryTab: 'grid',
  };
  let locationProvider = null;

  root.innerHTML = createShell();
  mountMapObserver();
  mountPhotoTileObserver();
  mountPhotoMapObserver(() => state);

  const photoServiceInstance = startPhotoService({
    onUpdate(photos) {
      state.photoData = photos;
      state.photoLoading = false;
      state.photoError = null;
      updatePhotoTile(photos, false);
      router.refresh();
    },
    onError(message) {
      state.photoLoading = false;
      state.photoError = message;
      updatePhotoTile([], false);
      router.refresh();
    },
  });

  const contentNode = root.querySelector("[data-app-content]");
  const navNode = root.querySelector("[data-app-nav]");

  router.mount(contentNode, navNode, () => state);

  root.addEventListener("change", async (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const filterKey = target.dataset.poiFilter;

    if (!filterKey) {
      return;
    }

    if (filterKey === "includeNeedsEnrichment" && target instanceof HTMLInputElement) {
      state.poiFilters = {
        ...state.poiFilters,
        [filterKey]: target.checked,
      };
    } else if (target instanceof HTMLSelectElement) {
      const nextValue = filterKey === "minScore" ? Number(target.value) : target.value;
      state.poiFilters = {
        ...state.poiFilters,
        [filterKey]: nextValue,
      };
    }

    router.refresh();
  });

  let lightboxIndex = 0;

  const IC_PIN = `<svg class="lc-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1C5.24 1 3 3.24 3 6c0 3.9 5 9 5 9s5-5.1 5-9c0-2.76-2.24-5-5-5zm0 6.8a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6z"/></svg>`;
  const IC_CAL = `<svg class="lc-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><rect x="1.5" y="3" width="13" height="11.5" rx="2"/><line x1="5" y1="1" x2="5" y2="4.5"/><line x1="11" y1="1" x2="11" y2="4.5"/><line x1="1.5" y1="7" x2="14.5" y2="7"/></svg>`;
  const IC_CLK = `<svg class="lc-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6.5"/><polyline points="8,4.5 8,8 10.5,10"/></svg>`;

  function updateLightboxDisplay() {
    const dialog = document.getElementById('photo-lightbox');
    if (!dialog) return;
    const photo = state.photoData[lightboxIndex];
    if (!photo) return;

    const img = dialog.querySelector('.photo-lightbox__img');
    const caption = dialog.querySelector('.photo-lightbox__caption');
    if (img) img.src = photo.url;
    if (!caption) return;

    const d = photo.date ? new Date(photo.date) : null;
    const dateChip = d ? `<span class="lc-chip">${IC_CAL}${d.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}</span>` : '';
    const timeChip = d ? `<span class="lc-chip">${IC_CLK}${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</span>` : '';
    const locChip = photo.lat != null ? `<span class="lc-chip" id="lc-loc">${IC_PIN}<span class="lc-loc-text">…</span></span>` : '';

    caption.innerHTML = `<div class="lc-chips">${dateChip}${timeChip}${locChip}</div>`;

    if (photo.lat != null) {
      const capturedIndex = lightboxIndex;
      geocodeOnce(photo.lat, photo.lon)
        .then((geo) => {
          if (lightboxIndex !== capturedIndex) return;
          const el = document.getElementById('lc-loc');
          if (el && geo?.locationLabel) {
            el.querySelector('.lc-loc-text').textContent = `${geo.locationLabel}${geo.flag ? ' ' + geo.flag : ''}`;
          }
        })
        .catch(() => {
          if (lightboxIndex !== capturedIndex) return;
          document.getElementById('lc-loc')?.remove();
        });
    }
  }

  function navigateLightbox(dir) {
    const next = lightboxIndex + dir;
    if (next < 0 || next >= state.photoData.length) return;
    lightboxIndex = next;
    updateLightboxDisplay();
  }

  root.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('[data-gallery-tab]');
    if (tabBtn) {
      state.galleryTab = tabBtn.dataset.galleryTab;
      router.refresh();
      return;
    }

    const forwardLimitBtn = e.target.closest('[data-forward-limit]');
    if (forwardLimitBtn) {
      const raw = forwardLimitBtn.dataset.forwardLimit;
      state.forwardLimit = raw === "all" ? Infinity : Number(raw);
      router.refresh();
      return;
    }

    const photoTrigger = e.target.closest('[data-lightbox-src]');
    if (photoTrigger) {
      e.preventDefault();
      lightboxIndex = parseInt(photoTrigger.dataset.lightboxIndex ?? '0', 10);
      const dialog = document.getElementById('photo-lightbox');
      if (dialog) {
        updateLightboxDisplay();
        dialog.showModal();
      }
      return;
    }

    if (e.target.closest('[data-lightbox-close]') || e.target === document.getElementById('photo-lightbox')) {
      document.getElementById('photo-lightbox')?.close();
    }
  });

  let touchStartX = 0;
  root.addEventListener('touchstart', (e) => {
    if (e.target.closest('#photo-lightbox')) touchStartX = e.touches[0].clientX;
  }, { passive: true });
  root.addEventListener('touchend', (e) => {
    if (!e.target.closest('#photo-lightbox')) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) navigateLightbox(dx < 0 ? 1 : -1);
  });

  document.addEventListener('keydown', (e) => {
    const dialog = document.getElementById('photo-lightbox');
    if (!dialog?.open) return;
    if (e.key === 'ArrowRight') navigateLightbox(1);
    if (e.key === 'ArrowLeft') navigateLightbox(-1);
  });

  try {
    state.routeData = await loadRouteData();
    state.countrySegments = buildCountrySegments(state.routeData);
    state.dailyStats = computeDailyStats(state.routeData, state.locationHistory);

    try {
      state.poiData = await loadPoiData();
      state.poiLoading = false;
    } catch (error) {
      state.poiError = error instanceof Error ? error.message : "POI-Daten konnten nicht geladen werden.";
      state.poiLoading = false;
    }

    locationProvider = createLocationProvider({
      routeData: state.routeData,
      onUpdate(snapshot) {
        state.previousLocationData = state.locationData;
        state.locationData = mapLocationToRoute(state.routeData, snapshot);
        state.locationHistory = appendToHistory(state.locationHistory, snapshot);
        state.dailyStats = computeDailyStats(state.routeData, state.locationHistory);
        updateLiveMap(state.locationData, state.routeData);
        state.locationLoading = false;
        state.locationError = null;
        state.locationProviderType = snapshot.providerType;

        // Skip re-renders on gallery grid/map tabs — content is photo-driven, not location-driven
        const onGallery = window.location.hash === '#/gallery';
        const onGalleryRouteTab = onGallery && state.galleryTab === 'route';

        reverseGeocode(snapshot.latitude, snapshot.longitude)
          .then((geocodeData) => {
            if (geocodeData) {
              state.geocodeData = geocodeData;
              if (!onGallery || onGalleryRouteTab) router.refresh();
            }
          })
          .catch(() => {});

        if (state.overpassUnavailable) {
          state.overpassPois = null;
          state.overpassUnavailable = false;
        }

        import("../services/wikipediaPoiService.js")
          .then(({ fetchWikipediaPois }) => fetchWikipediaPois(snapshot.latitude, snapshot.longitude))
          .then((pois) => {
            state.overpassPois = pois;
            state.overpassUnavailable = false;
            if (!onGallery || onGalleryRouteTab) router.refresh();
          })
          .catch((err) => {
            console.error("[WikipediaPOI]", err?.message || err);
            if (state.overpassPois === null) {
              state.overpassPois = [];
              state.overpassUnavailable = !!err?.poiUnavailable;
              if (!onGallery || onGalleryRouteTab) router.refresh();
            }
          });

        if (!onGallery || onGalleryRouteTab) router.refresh();
      },
      onError(message) {
        state.locationLoading = false;
        state.locationError = message;
        router.refresh();
      },
    });

    state.locationProviderType = locationProvider.type;
    await locationProvider.start();
  } catch (error) {
    state.routeError = error instanceof Error ? error.message : "Unbekannter Fehler beim Laden der Route.";
  } finally {
    state.routeLoading = false;
    state.poiLoading = false;
    router.refresh();
  }

  window.addEventListener("beforeunload", () => {
    locationProvider?.stop();
    photoServiceInstance.stop();
  });
}
