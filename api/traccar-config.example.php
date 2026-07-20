<?php
// Vorlage. Auf dem Webspace als api/traccar-config.php ablegen (gitignored,
// wird NICHT deployt — einmal manuell per FTP hochladen).
//
// Sobald diese Datei liegt, schaltet die App automatisch auf Live-GPS um.

return [
    // Traccar Cloud:
    'base_url' => 'https://server.traccar.org/api',

    // Token: in Traccar unter Einstellungen → Benutzer → eigenen Benutzer
    // oeffnen → "Token" generieren.
    'auth' => [
        'mode'  => 'bearer',
        'token' => 'dein-traccar-api-token',

        // Alternativ statt Token (dann mode auf 'basic' setzen):
        // 'mode' => 'basic', 'email' => 'du@example.com', 'password' => '...',
    ],

    // Das Geraet, das Timo dabei hat. uniqueId steht in Traccar beim Geraet
    // (und im Traccar Client auf dem iPhone unter "Geraete-Kennung").
    'device' => [
        'unique_id' => 'timo-iphone',
        // 'device_id' => 12345,   // alternativ die numerische ID
    ],

    // Zeitzone fuer die Tages-Abgrenzung (Kalendertag der Fahrer)
    'timezone' => 'Europe/Berlin',

    // Ab wann die tatsaechlich gefahrene Spur gesammelt wird. Frueher liegende
    // Testfahrten bleiben damit aus der Karte.
    'trip' => [
        'start_date' => '2026-07-19',
    ],
];
