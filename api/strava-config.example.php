<?php
// Vorlage. Auf dem Webspace als api/strava-config.php ablegen (gitignored,
// wird NICHT deployt — einmal manuell per FTP hochladen).
//
// Werte kommen aus https://www.strava.com/settings/api
// Refresh-Token: siehe docs/strava-setup.md

return [
    'client_id'     => '000000',
    'client_secret' => 'dein-strava-client-secret',
    'refresh_token' => 'dein-strava-refresh-token',

    // Ab diesem Tag zaehlen Fahrten zur Tour (davor = "vergangene Touren").
    // Gleicher Wert wie tripMeta.startDate in src/data/mockData.js.
    'trip_start'    => '2026-07-20',
];
