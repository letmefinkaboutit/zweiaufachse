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

// Traccar akzeptiert den API-Token je nach Version entweder als Bearer-Header
// ODER nur als Query-Parameter (?token=...). Wir probieren beides und merken
// uns, was funktioniert hat.
$GLOBALS['traccarAuthMode'] = null;

function traccarRequest(string $path, array $config, string $mode): array
{
    $baseUrl = rtrim((string) $config['base_url'], '/');
    $auth    = $config['auth'] ?? [];
    $token   = (string) ($auth['token'] ?? '');
    $url     = $baseUrl . $path;
    $headers = ['Accept: application/json'];

    if ($mode === 'bearer' && $token !== '') {
        $headers[] = 'Authorization: Bearer ' . $token;
    }

    if ($mode === 'query' && $token !== '') {
        $url .= (str_contains($path, '?') ? '&' : '?') . 'token=' . rawurlencode($token);
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
    ]);

    if ($mode === 'basic' && !empty($auth['email'])) {
        curl_setopt($ch, CURLOPT_USERPWD, $auth['email'] . ':' . ($auth['password'] ?? ''));
    }

    $body   = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return [
        'status' => $status,
        'body'   => is_string($body) ? $body : '',
        'data'   => is_string($body) ? json_decode($body, true) : null,
        'mode'   => $mode,
    ];
}

// Gibt Status UND Daten zurueck, damit "Token falsch" von "nichts gefunden"
// unterschieden werden kann.
function traccarCall(string $path, array $config): array
{
    $auth = $config['auth'] ?? [];

    // Bekannter Weg zuerst, sonst der Reihe nach durchprobieren
    $modes = $GLOBALS['traccarAuthMode'] !== null
        ? [$GLOBALS['traccarAuthMode']]
        : (($auth['mode'] ?? '') === 'basic'
            ? ['basic', 'bearer', 'query']
            : ['bearer', 'query', 'basic']);

    $last = ['status' => 0, 'body' => '', 'data' => null, 'mode' => 'none'];

    foreach ($modes as $mode) {
        if ($mode === 'basic' && empty($auth['email'])) {
            continue;
        }
        if (($mode === 'bearer' || $mode === 'query') && empty($auth['token'])) {
            continue;
        }

        $result = traccarRequest($path, $config, $mode);
        $last = $result;

        if ($result['status'] >= 200 && $result['status'] < 300) {
            $GLOBALS['traccarAuthMode'] = $mode;
            return $result;
        }
    }

    return $last;
}

function traccarGet(string $path, array $config): ?array
{
    $result = traccarCall($path, $config);

    if ($result['status'] < 200 || $result['status'] >= 300) {
        return null;
    }

    return $result['data'];
}

// ── Geraet aufloesen (gecacht) ──────────────────────────
$deviceId   = $cache['deviceId']   ?? null;
$deviceName = $cache['deviceName'] ?? null;
$deviceAt   = $cache['deviceAt']   ?? 0;

$wantedUniqueId = (string) ($config['device']['unique_id'] ?? '');

if ($deviceId === null || ($now - $deviceAt) > DEVICE_TTL) {
    // Alle Geraete des Kontos holen und selbst suchen — praeziser als der
    // uniqueId-Filter und liefert im Fehlerfall eine brauchbare Diagnose.
    $call    = traccarCall('/devices', $config);
    $devices = is_array($call['data']) ? $call['data'] : [];

    if ($call['status'] === 401 || $call['status'] === 403) {
        echo json_encode([
            'configured'  => false,
            'reason'      => 'Traccar lehnt den Token ab (HTTP ' . $call['status'] . ') — TRACCAR_TOKEN pruefen.',
            'traccarSays' => mb_substr(strip_tags($call['body']), 0, 300),
            'baseUrl'     => rtrim((string) $config['base_url'], '/'),
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($call['status'] < 200 || $call['status'] >= 300) {
        echo json_encode([
            'configured' => false,
            'reason'     => 'Traccar antwortete mit HTTP ' . $call['status']
                . ' (Auth-Versuche: Bearer, ?token=, Basic).',
            // Rohantwort hilft bei der Ursachensuche (enthaelt keinen Token)
            'traccarSays' => mb_substr(strip_tags($call['body']), 0, 300),
            'baseUrl'     => rtrim((string) $config['base_url'], '/'),
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $match = null;
    foreach ($devices as $device) {
        $unique = (string) ($device['uniqueId'] ?? '');
        $id     = (string) ($device['id'] ?? '');

        if ($unique === $wantedUniqueId || $id === $wantedUniqueId
            || (!empty($config['device']['device_id']) && $id === (string) $config['device']['device_id'])) {
            $match = $device;
            break;
        }
    }

    // Genau ein Geraet auf dem Konto? Dann ist die Sache eindeutig.
    if ($match === null && count($devices) === 1) {
        $match = $devices[0];
    }

    if ($match === null) {
        echo json_encode([
            'configured' => false,
            'reason'     => count($devices)
                ? 'Kein Geraet mit Kennung "' . $wantedUniqueId . '" gefunden.'
                : 'Auf diesem Traccar-Konto ist noch kein Geraet angelegt. '
                  . 'In Traccar Cloud ein Geraet mit der Kennung des iPhones anlegen.',
            // Hilft beim Einrichten: welche Geraete gibt es wirklich?
            'availableDevices' => array_map(
                fn($d) => [
                    'name'       => $d['name'] ?? null,
                    'uniqueId'   => $d['uniqueId'] ?? null,
                    'status'     => $d['status'] ?? null,
                    'lastUpdate' => $d['lastUpdate'] ?? null,
                ],
                $devices
            ),
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $deviceId   = $match['id'] ?? null;
    $deviceName = $match['name'] ?? 'Traccar';
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
