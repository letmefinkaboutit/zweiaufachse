<?php
// Strava-Proxy: haelt die Zugangsdaten serverseitig (Client-Secret und
// Refresh-Token duerfen NIE im Browser landen), holt Aktivitaeten,
// aggregiert sie und cacht das Ergebnis.
//
// Einrichtung (siehe docs/strava-setup.md):
//   1. api/strava-config.php aus strava-config.example.php erstellen
//   2. Client-ID, Client-Secret und Refresh-Token eintragen
//   3. Diese Datei per FTP hochladen (config bleibt gitignored)
//
// Antwort:
//   { "configured": bool, "totals": {...}, "tripDays": {...}, "tripTours": [...], "pastTours": [...] }
//
// Mit ?debug=1 kommt stattdessen eine Diagnose: wie viele Aktivitaeten Strava
// liefert, welche Sportarten dabei sind und welcher trip_start konfiguriert
// ist. Umgeht den Cache — sonst diagnostiziert man den alten Stand.

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

// Strava kennt mehrere Rad-Sportarten. Frueher zaehlte nur exakt "Ride" —
// eine als E-Bike- oder Gravel-Fahrt aufgezeichnete Etappe fiel damit aus
// BEIDEN Listen und war schlicht unsichtbar, ohne Fehlermeldung.
const RIDE_TYPES = [
    'Ride',
    'GravelRide',
    'MountainBikeRide',
    'EBikeRide',
    'EMountainBikeRide',
    'Velomobile',
    'Handcycle',
];

const CACHE_TTL_SECONDS = 900;          // 15 min — Strava erlaubt 100 Calls/15 min
const ACTIVITY_PAGES    = 3;            // bis zu 3 x 100 Aktivitaeten
const CACHE_FILE        = __DIR__ . '/strava-cache.json';
const TOKEN_FILE        = __DIR__ . '/strava-token.json';
const CONFIG_FILE       = __DIR__ . '/strava-config.php';

if (!is_file(CONFIG_FILE)) {
    echo json_encode([
        'configured' => false,
        'reason'     => 'api/strava-config.php fehlt auf dem Server.',
    ]);
    exit;
}

$config = require CONFIG_FILE;

$debug = isset($_GET['debug']) && $_GET['debug'] !== '0';

// ── Cache ───────────────────────────────────────────────
if (!$debug && is_file(CACHE_FILE) && (time() - filemtime(CACHE_FILE)) < CACHE_TTL_SECONDS) {
    readfile(CACHE_FILE);
    exit;
}

// ── Access-Token per Refresh-Token besorgen ─────────────
function getAccessToken(array $config): ?string
{
    if (is_file(TOKEN_FILE)) {
        $token = json_decode((string) @file_get_contents(TOKEN_FILE), true);
        if (is_array($token) && ($token['expires_at'] ?? 0) > time() + 120) {
            return $token['access_token'];
        }
    }

    $response = httpPost('https://www.strava.com/oauth/token', [
        'client_id'     => $config['client_id'],
        'client_secret' => $config['client_secret'],
        'grant_type'    => 'refresh_token',
        'refresh_token' => $config['refresh_token'],
    ]);

    if (!isset($response['access_token'])) {
        return null;
    }

    @file_put_contents(TOKEN_FILE, json_encode([
        'access_token' => $response['access_token'],
        'expires_at'   => $response['expires_at'] ?? (time() + 18000),
    ]));

    return $response['access_token'];
}

function httpPost(string $url, array $fields): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => http_build_query($fields),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
    ]);
    $body = curl_exec($ch);
    curl_close($ch);

    return is_string($body) ? (json_decode($body, true) ?? []) : [];
}

function httpGet(string $url, string $token): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_HTTPHEADER     => ["Authorization: Bearer {$token}"],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 20,
    ]);
    $body = curl_exec($ch);
    curl_close($ch);

    return is_string($body) ? (json_decode($body, true) ?? []) : [];
}

$token = getAccessToken($config);

if ($token === null) {
    echo json_encode([
        'configured' => false,
        'reason'     => 'Strava-Token konnte nicht erneuert werden (Refresh-Token pruefen).',
    ]);
    exit;
}

// ── Aktivitaeten laden ──────────────────────────────────
$activities = [];
for ($page = 1; $page <= ACTIVITY_PAGES; $page++) {
    $chunk = httpGet("https://www.strava.com/api/v3/athlete/activities?per_page=100&page={$page}", $token);
    if (!is_array($chunk) || !count($chunk)) {
        break;
    }
    $activities = array_merge($activities, $chunk);
    if (count($chunk) < 100) {
        break;
    }
}

$tripStart = $config['trip_start'] ?? null;   // "YYYY-MM-DD" oder null

$totals = [
    'distanceKm'   => 0.0,
    'elevationM'   => 0.0,
    'calories'     => 0.0,
    'rides'        => 0,
    'avgHeartrate' => null,
    'maxHeartrate' => null,
];
$hrSum = 0.0;
$hrCount = 0;
$tripDays  = [];
$tripTours = [];
$pastTours = [];

// Diagnose: erst zaehlen, dann filtern — sonst sieht man gerade das nicht,
// was rausfaellt.
$seenSportTypes = [];
$skipped = [];
$newest = [];

foreach ($activities as $activity) {
    if (!is_array($activity)) {
        continue;
    }

    $sportType = (string) ($activity['sport_type'] ?? '');
    $legacyType = (string) ($activity['type'] ?? '');
    $effectiveType = $sportType !== '' ? $sportType : $legacyType;
    $startLocal = substr((string) ($activity['start_date_local'] ?? ''), 0, 10);

    $key = $effectiveType !== '' ? $effectiveType : '(ohne Typ)';
    $seenSportTypes[$key] = ($seenSportTypes[$key] ?? 0) + 1;

    if (count($newest) < 10) {
        $newest[] = [
            'date'       => $startLocal,
            'name'       => (string) ($activity['name'] ?? ''),
            'type'       => $legacyType,
            'sport_type' => $sportType,
            'distanceKm' => round(((float) ($activity['distance'] ?? 0)) / 1000, 1),
        ];
    }

    $isRide = in_array($sportType, RIDE_TYPES, true) || in_array($legacyType, RIDE_TYPES, true);

    if (!$isRide) {
        $skipped[] = ['date' => $startLocal, 'type' => $legacyType, 'sport_type' => $sportType];
        continue;
    }

    $distanceKm = ((float) ($activity['distance'] ?? 0)) / 1000;
    $elevationM = (float) ($activity['total_elevation_gain'] ?? 0);
    $movingTime = (int) ($activity['moving_time'] ?? 0);
    $elapsedTime = (int) ($activity['elapsed_time'] ?? 0);
    // kilojoules ~ kcal bei Radfahren (Wirkungsgrad ~24 % hebt sich raus)
    $calories   = (float) ($activity['kilojoules'] ?? 0);
    $avgHr      = isset($activity['average_heartrate']) ? (float) $activity['average_heartrate'] : null;
    $maxHr      = isset($activity['max_heartrate']) ? (float) $activity['max_heartrate'] : null;

    $totals['distanceKm'] += $distanceKm;
    $totals['elevationM'] += $elevationM;
    $totals['calories']   += $calories;
    $totals['rides']++;

    if ($avgHr !== null) {
        $hrSum += $avgHr;
        $hrCount++;
    }
    if ($maxHr !== null) {
        $totals['maxHeartrate'] = max($totals['maxHeartrate'] ?? 0, $maxHr);
    }

    $isTripRide = $tripStart !== null && $startLocal >= $tripStart;

    if ($isTripRide) {
        if (!isset($tripDays[$startLocal])) {
            $tripDays[$startLocal] = [
                'distanceKm' => 0.0,
                'elevationM' => 0.0,
                'calories'   => 0.0,
                'movingTime' => 0,
                'elapsedTime'=> 0,
                'hrSum'      => 0.0,
                'hrWeight'   => 0,
                'maxHeartrate' => null,
                'rides'      => 0,
            ];
        }
        $tripDays[$startLocal]['distanceKm'] += $distanceKm;
        $tripDays[$startLocal]['elevationM'] += $elevationM;
        $tripDays[$startLocal]['calories']   += $calories;
        $tripDays[$startLocal]['movingTime'] += $movingTime;
        $tripDays[$startLocal]['elapsedTime'] += $elapsedTime;
        $tripDays[$startLocal]['rides']++;
        if ($avgHr !== null) {
            $weight = max(1, $movingTime);
            $tripDays[$startLocal]['hrSum'] += $avgHr * $weight;
            $tripDays[$startLocal]['hrWeight'] += $weight;
        }
        if ($maxHr !== null) {
            $tripDays[$startLocal]['maxHeartrate'] = max($tripDays[$startLocal]['maxHeartrate'] ?? 0, $maxHr);
        }

        $tripTours[] = [
            'name'        => (string) ($activity['name'] ?? 'Tour'),
            'date'        => $startLocal,
            'distanceKm'  => round($distanceKm, 1),
            'elevationM'  => round($elevationM),
            'movingTime'  => $movingTime,
            'elapsedTime' => $elapsedTime,
            'calories'    => round($calories),
            'avgHeartrate'=> $avgHr !== null ? round($avgHr) : null,
            'maxHeartrate'=> $maxHr !== null ? round($maxHr) : null,
        ];
    } else {
        $pastTours[] = [
            'name'       => (string) ($activity['name'] ?? 'Tour'),
            'date'       => $startLocal,
            'distanceKm' => round($distanceKm, 1),
            'elevationM' => round($elevationM),
            'movingTime' => $movingTime,
        ];
    }
}

if ($hrCount > 0) {
    $totals['avgHeartrate'] = round($hrSum / $hrCount);
}
$totals['distanceKm'] = round($totals['distanceKm'], 1);
$totals['elevationM'] = round($totals['elevationM']);
$totals['calories']   = round($totals['calories']);

// Nur die laengsten/juengsten Touren als Kontext
usort($pastTours, fn($a, $b) => strcmp($b['date'], $a['date']));
$pastTours = array_slice($pastTours, 0, 20);

foreach ($tripDays as $day => $values) {
    $tripDays[$day] = [
        'distanceKm'   => round($values['distanceKm'], 1),
        'elevationM'   => round($values['elevationM']),
        'calories'     => round($values['calories']),
        'movingTime'   => $values['movingTime'],
        'elapsedTime'  => $values['elapsedTime'],
        'avgHeartrate' => $values['hrWeight'] > 0 ? round($values['hrSum'] / $values['hrWeight']) : null,
        'maxHeartrate' => $values['maxHeartrate'] !== null ? round($values['maxHeartrate']) : null,
        'rides'        => $values['rides'],
    ];
}
krsort($tripDays);
usort($tripTours, fn($a, $b) => strcmp($b['date'], $a['date']));

if ($debug) {
    // Diagnose-Antwort: beantwortet, warum eine Etappe fehlt. Bewusst OHNE
    // Cache-Schreiben — sonst laege die Diagnose als normale Antwort im Cache.
    echo json_encode([
        'debug'              => true,
        'tripStart'          => $tripStart,
        'aktivitaetenGesamt' => count($activities),
        'davonRadfahrten'    => $totals['rides'],
        'sportarten'         => $seenSportTypes,
        'verworfen'          => $skipped,
        'neueste'            => $newest,
        'tripTage'           => array_keys($tripDays),
        'akzeptierteTypen'   => RIDE_TYPES,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    exit;
}

$payload = json_encode([
    'configured' => true,
    'updatedAt'  => gmdate('c'),
    'totals'     => $totals,
    'tripDays'   => $tripDays,
    'tripTours'  => $tripTours,
    'pastTours'  => $pastTours,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

@file_put_contents(CACHE_FILE, $payload);
echo $payload;
