import { renderDashboardPage } from "../pages/dashboardPage.js";
import { renderRoutePage } from "../pages/routePage.js";
import { renderUpdatesPage } from "../pages/updatesPage.js";
import { renderStatsPage } from "../pages/statsPage.js";
import { renderGalleryPage } from "../pages/galleryPage.js";
import { renderProfilesPage } from "../pages/profilesPage.js";
import { renderStatusPage } from "../pages/statusPage.js";
import { renderStoriesPage } from "../pages/storiesPage.js";
import { renderHomeInfoPage } from "../pages/homeInfoPage.js";
import { renderSettingsPage } from "../pages/settingsPage.js";

export const moduleRegistry = [
  {
    id: "dashboard",
    route: "/dashboard",
    navLabel: "Start",
    shortLabel: "01",
    title: "Dashboard",
    description: "Schneller Ueberblick fuer heute.",
    enabled: true,
    defaultRoute: true,
    featured: true,
    render: renderDashboardPage,
  },
  {
    id: "route",
    route: "/route",
    navLabel: "Route",
    shortLabel: "02",
    title: "Reiseverlauf",
    description: "Wo sie gestartet sind und wo sie gerade stehen.",
    enabled: true,
    featured: true,
    render: renderRoutePage,
  },
  {
    id: "updates",
    route: "/updates",
    navLabel: "Updates",
    shortLabel: "03",
    title: "Tagesupdates",
    description: "Die neuesten Etappen, Pannen und Highlights.",
    enabled: true,
    featured: true,
    render: renderUpdatesPage,
  },
  {
    id: "stats",
    route: "/stats",
    navLabel: "Stats",
    shortLabel: "04",
    title: "Statistiken",
    description: "Kilometer, Hoehenmeter und halb-serioese Werte.",
    enabled: true,
    featured: true,
    render: renderStatsPage,
  },
  {
    id: "gallery",
    route: "/gallery",
    navLabel: "Galerie",
    shortLabel: "05",
    title: "Galerie",
    description: "Platz fuer Fotos und Videos von unterwegs.",
    enabled: true,
    featured: true,
    render: renderGalleryPage,
  },
  {
    id: "profiles",
    route: "/profiles",
    navLabel: "Fahrer",
    shortLabel: "06",
    title: "Fahrerprofile",
    description: "Wer tritt wie in die Pedale.",
    enabled: true,
    render: renderProfilesPage,
  },
  {
    id: "status",
    route: "/status",
    navLabel: "Status",
    shortLabel: "07",
    title: "Live-Status",
    description: "Aktueller Zustand zwischen Flow und Balkan-Chaos.",
    enabled: true,
    render: renderStatusPage,
  },
  {
    id: "stories",
    route: "/stories",
    navLabel: "Story",
    shortLabel: "08",
    title: "Story & Entertainment",
    description: "Running Gags, Awards und Reiseanekdoten.",
    enabled: true,
    render: renderStoriesPage,
  },
  {
    id: "home-info",
    route: "/daheim",
    navLabel: "Daheim",
    shortLabel: "09",
    title: "Info fuer Daheimgebliebene",
    description: "Einfach erklaert, wie man die Reise begleitet.",
    enabled: true,
    render: renderHomeInfoPage,
  },
  {
    id: "settings",
    route: "/settings",
    navLabel: "Setup",
    shortLabel: "10",
    title: "Einstellungen & Admin-Vorbereitung",
    description: "Struktur fuer spaetere Pflege von Inhalten und Daten.",
    enabled: true,
    render: renderSettingsPage,
  },
];

export const navigationModules = moduleRegistry;
