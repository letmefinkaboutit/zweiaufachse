<?php
// Traccar-Proxy: haelt den API-Token serverseitig (im Browser waere er lesbar),
// umgeht das CORS-Problem und rechnet die Tageskilometer gleich mit.
//
// Einrichtung (siehe docs/setup-live.md):
//   1. api/traccar-config.php aus traccar-config.example.php erstellen
//   2. Traccar-URL, Token und Geraete-ID eintragen
//   3. Diese Datei per FTP hochladen (config bleibt gitignored)
//
// Antwort:
//   { "configured": bool, "position": {...}, "daily": { "todayKm":, "yesterdayKm": } }

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

const POSITION_TTL = 20;    // s — Traccar-Client sendet eh nur alle 30-60 s
const DAILY_TTL    = 300;   // s — Tageskilometer aendern sich langsam
const DEVICE_TTL   = 3600;  // s — Geraete-ID aendert sich praktisch nie

const CACHE_FILE  = __DIR__ . '/traccar-cache.json';
const CONFIG_FILE = __DIR__ . '/traccar-config.php';

if (!is_file(CONFIG_FILE)) {
    echo json_encode([
        'configured' => false,
        'reason'     => 'api/traccar-config.php fehlt auf dem Server.',
    ]);
    exit;
}

$config = require CONFIG_FILE;
$baseUrl = rtrim((string) ($config['base_url'] ?? ''), '/');

$cache = is_file(CACHE_FILE)
    ? (json_decode((string) @file_get_contents(CACHE_FILE), true) ?: [])
    : [];

$now = time();

// Alles noch frisch? Dann direkt ausliefern.
if (
    isset($cache['position'], $cache['positionAt'], $cache['daily'], $cache['dailyAt'])
    && ($now - $cache['positionAt']) < POSITION_TTL
    && ($now - $cache['dailyAt']) < DAILY_TTL
) {
    echo json_encode([
        'configured' => true,
        'position'   => $cache['position'],
        'daily'      => $cache['daily'],
        'cached'     => true,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

function traccarGet(string $path, array $config): ?array
{
    $baseUrl = rtrim((string) $config['base_url'], '/');
    $auth    = $config['auth'] ?? [];
    $headers = ['Accept: application/json'];

    if (($auth['mode'] ?? '') === 'bearer' && !empty($auth['token'])) {
        $headers[] = 'Authorization: Bearer ' . $auth['token'];
    }

    $ch = curl_init($baseUrl . $path);
    curl_setopt_array($ch, [
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
    ]);

    if (($auth['mode'] ?? '') === 'basic' && !empty($auth['email'])) {
        curl_setopt($ch, CURLOPT_USERPWD, $auth['email'] . ':' . ($auth['password'] ?? ''));
    }

    $body   = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($status < 200 || $status >= 300 || !is_string($body)) {
        return null;
    }

    return json_decode($body, true);
}

// ── Geraet aufloesen (gecacht) ──────────────────────────
$deviceId   = $cache['deviceId']   ?? null;
$deviceName = $cache['deviceName'] ?? null;
$deviceAt   = $cache['deviceAt']   ?? 0;

if ($deviceId === null || ($now - $deviceAt) > DEVICE_TTL) {
    $device = $config['device'] ?? [];
    $query  = !empty($device['device_id'])
        ? '?id=' . rawurlencode((string) $device['device_id'])
        : '?uniqueId=' . rawurlencode((string) ($device['unique_id'] ?? ''));

    $devices = traccarGet('/devices' . $query, $config);

    if (!is_array($devices) || !count($devices)) {
        echo json_encode([
            'configured' => false,
            'reason'     => 'Traccar erreichbar, aber kein passendes Geraet gefunden (uniqueId pruefen).',
        ]);
        exit;
    }

    $deviceId   = $devices[0]['id'] ?? null;
    $deviceName = $devices[0]['name'] ?? 'Traccar';
    $deviceAt   = $now;
}

// ── Aktuelle Position ───────────────────────────────────
$position = $cache['position'] ?? null;
$positionAt = $cache['positionAt'] ?? 0;

if ($position === null || ($now - $positionAt) >= POSITION_TTL) {
    $positions = traccarGet('/positions?deviceId=' . rawurlencode((string) $deviceId), $config);

    if (is_array($positions) && count($positions)) {
        $p = $positions[0];
        $attributes = $p['attributes'] ?? [];

        $position = [
            'latitude'      => $p['latitude'] ?? null,
            'longitude'     => $p['longitude'] ?? null,
            'altitudeMeters'=> $p['altitude'] ?? null,
            // Traccar liefert Knoten → km/h
            'speedKph'      => isset($p['speed']) ? round(((float) $p['speed']) * 1.852, 1) : 0,
            'course'        => $p['course'] ?? null,
            'timestamp'     => $p['fixTime'] ?? ($p['deviceTime'] ?? ($p['serverTime'] ?? null)),
            'accuracyMeters'=> $p['accuracy'] ?? null,
            'batteryLevel'  => $attributes['batteryLevel'] ?? ($attributes['battery'] ?? null),
            'motion'        => (bool) ($attributes['motion'] ?? false),
            'deviceName'    => $deviceName,
        ];
        $positionAt = $now;
    }
}

// ── Tageskilometer (heute/gestern) ──────────────────────
$daily = $cache['daily'] ?? ['todayKm' => null, 'yesterdayKm' => null];
$dailyAt = $cache['dailyAt'] ?? 0;

if (($now - $dailyAt) >= DAILY_TTL) {
    $timezone = new DateTimeZone($config['timezone'] ?? 'Europe/Berlin');

    $dayKm = function (int $offsetDays) use ($config, $deviceId, $timezone): ?float {
        $from = new DateTime('today', $timezone);
        $from->modify(sprintf('%+d days', $offsetDays));
        $to = (clone $from)->modify('+1 day');

        $nowLocal = new DateTime('now', $timezone);
        if ($to > $nowLocal) {
            $to = $nowLocal;
        }

        $summaries = traccarGet(
            '/reports/summary'
            . '?deviceId=' . rawurlencode((string) $deviceId)
            . '&from=' . rawurlencode($from->format('Y-m-d\TH:i:s\Z'))
            . '&to=' . rawurlencode($to->format('Y-m-d\TH:i:s\Z')),
            $config
        );

        if (!is_array($summaries)) {
            return null;   // Fehler → alten Wert behalten
        }
        if (!count($summaries)) {
            return 0.0;    // keine Fahrt an dem Tag
        }

        return round(((float) ($summaries[0]['distance'] ?? 0)) / 1000, 1);
    };

    $today     = $dayKm(0);
    $yesterday = $dayKm(-1);

    $daily = [
        'todayKm'     => $today     ?? ($daily['todayKm'] ?? null),
        'yesterdayKm' => $yesterday ?? ($daily['yesterdayKm'] ?? null),
    ];
    $dailyAt = $now;
}

@file_put_contents(CACHE_FILE, json_encode([
    'deviceId'   => $deviceId,
    'deviceName' => $deviceName,
    'deviceAt'   => $deviceAt,
    'position'   => $position,
    'positionAt' => $positionAt,
    'daily'      => $daily,
    'dailyAt'    => $dailyAt,
]));

echo json_encode([
    'configured' => true,
    'position'   => $position,
    'daily'      => $daily,
], JSON_UNESCAPED_UNICODE);
