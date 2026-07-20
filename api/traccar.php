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
//
// Mit ?track=1 kommt zusaetzlich die tatsaechlich gefahrene Spur seit Reisestart:
//   "track": { "points": [[lat,lon], ...], "complete": bool, "pointCount": int }
// Die ist um ein Vielfaches groesser als eine Position — deshalb nur auf
// Anforderung, nicht bei jedem Positions-Poll.

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

const POSITION_TTL = 20;    // s — Traccar-Client sendet eh nur alle 30-60 s
const DAILY_TTL    = 300;   // s — Tageskilometer aendern sich langsam
const DEVICE_TTL   = 3600;  // s — Geraete-ID aendert sich praktisch nie
const TRACK_TTL    = 300;   // s — nur der laufende Tag waechst ueberhaupt noch

// Ein Reisetag hat bei 30-60 s Sendetakt ~1500 Rohpunkte. Ueber drei Wochen
// waeren das 30.000 — viel zu viel fuer eine Handy-Karte. Deshalb wird jeder
// Tag einmal geholt, auf ~20 m Genauigkeit ausgeduennt und dauerhaft behalten:
// vergangene Tage aendern sich nicht mehr.
const TRACK_SIMPLIFY_M     = 20;
const TRACK_MAX_ACCURACY_M = 150;   // Ausreisser (Tunnel, Zug) fliegen raus
const TRACK_MAX_POINTS     = 6000;
// Beim allerersten Aufruf fehlen alle Tage. Statt sie in einem Request zu
// holen (Timeout), fuellt sich der Cache ueber mehrere Aufrufe auf.
const TRACK_MAX_DAYS_PER_REQUEST = 3;

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

// Sicherung: ohne gueltige Zugangsdaten wird Traccar NICHT angefasst.
$authMode = $config['auth']['mode'] ?? '';
$hasCreds = ($authMode === 'basic' && !empty($config['auth']['email']))
    || (($authMode === 'bearer' || $authMode === 'query') && !empty($config['auth']['token']));

if (!$hasCreds) {
    echo json_encode([
        'configured' => false,
        'reason'     => 'Traccar-Zugangsdaten fehlen (TRACCAR_EMAIL/PASSWORD als Secret setzen).',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$cache = is_file(CACHE_FILE)
    ? (json_decode((string) @file_get_contents(CACHE_FILE), true) ?: [])
    : [];

$now = time();

// Abkuehlphase nach Auth-Fehler: schlaegt Traccar den Login ab (401/403),
// fassen wir den Server 15 Minuten lang NICHT mehr an. Sonst loest das
// Dauer-Polling der App eine Brute-Force-Sperre des Kontos aus.
const AUTH_COOLDOWN = 900;
if (isset($cache['authFailedAt']) && ($now - $cache['authFailedAt']) < AUTH_COOLDOWN) {
    $remaining = AUTH_COOLDOWN - ($now - $cache['authFailedAt']);
    echo json_encode([
        'configured' => false,
        'reason'     => 'Login von Traccar abgelehnt. Neuer Versuch in '
            . ceil($remaining / 60) . ' Min (Schutz vor Konto-Sperre).',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Merkt sich einen Auth-Fehler und beendet die Anfrage.
function failAuth(array $cache, string $reason, string $raw = '', string $baseUrl = ''): void
{
    $cache['authFailedAt'] = time();
    @file_put_contents(CACHE_FILE, json_encode($cache));

    $payload = ['configured' => false, 'reason' => $reason];
    if ($raw !== '')     $payload['traccarSays'] = mb_substr(strip_tags($raw), 0, 300);
    if ($baseUrl !== '') $payload['baseUrl'] = $baseUrl;
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

$wantTrack = isset($_GET['track']) && $_GET['track'] !== '0';

// Alles noch frisch? Dann direkt ausliefern.
if (
    isset($cache['position'], $cache['positionAt'], $cache['daily'], $cache['dailyAt'])
    && ($now - $cache['positionAt']) < POSITION_TTL
    && ($now - $cache['dailyAt']) < DAILY_TTL
    && (!$wantTrack || (isset($cache['trackAt']) && ($now - $cache['trackAt']) < TRACK_TTL))
) {
    $payload = [
        'configured' => true,
        'position'   => $cache['position'],
        'daily'      => $cache['daily'],
        'cached'     => true,
    ];
    if ($wantTrack) {
        $payload['track'] = trackPayload($cache['trackDays'] ?? [], $cache['trackComplete'] ?? false);
    }
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
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

// Genau EIN Auth-Versuch pro Aufruf mit dem konfigurierten Modus.
// Kein Durchprobieren mehrerer Wege — das wuerde bei falschen Zugangsdaten
// die Brute-Force-Sperre von Traccar ausloesen.
function traccarCall(string $path, array $config): array
{
    $auth = $config['auth'] ?? [];
    $mode = $auth['mode'] ?? 'bearer';

    // Basic braucht E-Mail, Bearer/Query brauchen einen Token
    if ($mode === 'basic' && empty($auth['email'])) {
        return ['status' => 0, 'body' => 'Basic-Auth ohne E-Mail konfiguriert', 'data' => null, 'mode' => $mode];
    }
    if (($mode === 'bearer' || $mode === 'query') && empty($auth['token'])) {
        return ['status' => 0, 'body' => 'Token-Auth ohne Token konfiguriert', 'data' => null, 'mode' => $mode];
    }

    return traccarRequest($path, $config, $mode);
}

function traccarGet(string $path, array $config): ?array
{
    $result = traccarCall($path, $config);

    if ($result['status'] < 200 || $result['status'] >= 300) {
        return null;
    }

    return $result['data'];
}

// ── Gefahrene Spur ──────────────────────────────────────

// Douglas-Peucker: behaelt die Form der Strecke, wirft aber alles weg, was
// weniger als $epsilon von der Verbindungslinie abweicht. Iterativ statt
// rekursiv — bei einem Tag am Stueck waere die Rekursion sonst tief.
function trackSimplify(array $points, float $epsilonMeters): array
{
    $count = count($points);
    if ($count < 3) {
        return $points;
    }

    // Grad → Meter, lokal linearisiert. Auf Reiselaenge genau genug.
    $latToM = 111320.0;
    $lonToM = 111320.0 * max(0.1, cos(deg2rad($points[0][0])));

    $keep = array_fill(0, $count, false);
    $keep[0] = true;
    $keep[$count - 1] = true;

    $stack = [[0, $count - 1]];

    while ($stack) {
        [$first, $last] = array_pop($stack);
        if ($last <= $first + 1) {
            continue;
        }

        $ax = $points[$first][1] * $lonToM;
        $ay = $points[$first][0] * $latToM;
        $bx = $points[$last][1] * $lonToM;
        $by = $points[$last][0] * $latToM;
        $dx = $bx - $ax;
        $dy = $by - $ay;
        $lengthSquared = ($dx * $dx) + ($dy * $dy);

        $maxDistance = -1.0;
        $maxIndex = $first;

        for ($i = $first + 1; $i < $last; $i++) {
            $px = $points[$i][1] * $lonToM;
            $py = $points[$i][0] * $latToM;

            if ($lengthSquared <= 0.0) {
                // Start und Ende identisch (Standzeit) → reiner Abstand zum Punkt
                $distance = sqrt((($px - $ax) ** 2) + (($py - $ay) ** 2));
            } else {
                $t = ((($px - $ax) * $dx) + (($py - $ay) * $dy)) / $lengthSquared;
                $t = max(0.0, min(1.0, $t));
                $distance = sqrt(((($ax + ($t * $dx)) - $px) ** 2) + ((($ay + ($t * $dy)) - $py) ** 2));
            }

            if ($distance > $maxDistance) {
                $maxDistance = $distance;
                $maxIndex = $i;
            }
        }

        if ($maxDistance > $epsilonMeters) {
            $keep[$maxIndex] = true;
            $stack[] = [$first, $maxIndex];
            $stack[] = [$maxIndex, $last];
        }
    }

    $result = [];
    for ($i = 0; $i < $count; $i++) {
        if ($keep[$i]) {
            $result[] = $points[$i];
        }
    }

    return $result;
}

// Tages-Spuren (Schluessel = Datum) in eine durchgehende Linie giessen.
function trackPayload(array $days, bool $complete): array
{
    ksort($days);

    $points = [];
    foreach ($days as $dayPoints) {
        foreach ($dayPoints as $point) {
            $points[] = $point;
        }
    }

    // Notbremse: sollte die Ausduennung mal nicht reichen, gleichmaessig kuerzen.
    $total = count($points);
    if ($total > TRACK_MAX_POINTS) {
        $stride = (int) ceil($total / TRACK_MAX_POINTS);
        $thinned = [];
        for ($i = 0; $i < $total; $i += $stride) {
            $thinned[] = $points[$i];
        }
        $thinned[] = $points[$total - 1];
        $points = $thinned;
    }

    return [
        'points'     => $points,
        'pointCount' => count($points),
        // false, solange noch Tage nachgeladen werden — die App zeichnet
        // trotzdem schon, was da ist.
        'complete'   => $complete,
    ];
}

function fetchDayTrack(string $day, array $config, $deviceId, DateTimeZone $timezone): ?array
{
    $from = new DateTime($day . ' 00:00:00', $timezone);
    $to   = (clone $from)->modify('+1 day');

    $nowLocal = new DateTime('now', $timezone);
    if ($from > $nowLocal) {
        return [];   // Tag liegt in der Zukunft
    }
    if ($to > $nowLocal) {
        $to = $nowLocal;
    }

    $utc = new DateTimeZone('UTC');
    $positions = traccarGet(
        '/reports/route'
        . '?deviceId=' . rawurlencode((string) $deviceId)
        . '&from=' . rawurlencode((clone $from)->setTimezone($utc)->format('Y-m-d\TH:i:s\Z'))
        . '&to=' . rawurlencode((clone $to)->setTimezone($utc)->format('Y-m-d\TH:i:s\Z')),
        $config
    );

    if (!is_array($positions)) {
        return null;   // Fehler → Tag bleibt offen, naechster Aufruf versucht es erneut
    }

    $points = [];
    foreach ($positions as $position) {
        if (!isset($position['latitude'], $position['longitude'])) {
            continue;
        }
        if (isset($position['accuracy']) && (float) $position['accuracy'] > TRACK_MAX_ACCURACY_M) {
            continue;
        }
        // 5 Nachkommastellen ≈ 1 m — mehr braucht eine gezeichnete Linie nicht.
        $points[] = [round((float) $position['latitude'], 5), round((float) $position['longitude'], 5)];
    }

    return trackSimplify($points, TRACK_SIMPLIFY_M);
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
        failAuth(
            $cache,
            'Traccar lehnt die Anmeldung ab (HTTP ' . $call['status'] . ') — Zugangsdaten pruefen.',
            $call['body'],
            rtrim((string) $config['base_url'], '/')
        );
    }

    if ($call['status'] < 200 || $call['status'] >= 300) {
        echo json_encode([
            'configured'  => false,
            'reason'      => 'Traccar antwortete mit HTTP ' . $call['status'] . '.',
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

// ── Gefahrene Spur nachfuehren ──────────────────────────
$trackDays     = $cache['trackDays'] ?? [];
$trackAt       = $cache['trackAt'] ?? 0;
$trackComplete = $cache['trackComplete'] ?? false;

if ($wantTrack && ($now - $trackAt) >= TRACK_TTL) {
    $timezone  = new DateTimeZone($config['timezone'] ?? 'Europe/Berlin');
    $tripStart = (string) ($config['trip']['start_date'] ?? '2026-07-19');
    $today     = (new DateTime('now', $timezone))->format('Y-m-d');

    // Alle Reisetage bis heute auflisten.
    $wanted = [];
    $cursor = new DateTime($tripStart . ' 00:00:00', $timezone);
    $end    = new DateTime($today . ' 00:00:00', $timezone);
    while ($cursor <= $end) {
        $wanted[] = $cursor->format('Y-m-d');
        $cursor->modify('+1 day');
    }

    // Der laufende Tag waechst noch — der wird immer neu geholt. Alle
    // frueheren Tage nur, solange sie noch fehlen.
    $missing = array_values(array_filter(
        $wanted,
        fn(string $day) => $day === $today || !array_key_exists($day, $trackDays)
    ));

    $budget = TRACK_MAX_DAYS_PER_REQUEST;
    foreach ($missing as $day) {
        if ($budget <= 0) {
            break;
        }
        $budget--;

        $dayTrack = fetchDayTrack($day, $config, $deviceId, $timezone);
        if ($dayTrack === null) {
            // Antwortet Traccar nicht, hat es keinen Zweck, es fuer die
            // naechsten Tage im selben Aufruf nochmal zu versuchen.
            break;
        }

        $trackDays[$day] = $dayTrack;
    }

    // Tage ausserhalb der Reise (z. B. nach Verschieben des Startdatums)
    // wieder loswerden, damit der Cache nicht ewig mitwaechst.
    $trackDays = array_intersect_key($trackDays, array_flip($wanted));

    $trackComplete = count(array_diff($wanted, array_keys($trackDays))) === 0;
    $trackAt = $now;
}

@file_put_contents(CACHE_FILE, json_encode([
    // Erfolg: eine evtl. gesetzte Abkuehl-Markierung faellt hier weg
    'deviceId'      => $deviceId,
    'deviceName'    => $deviceName,
    'deviceAt'      => $deviceAt,
    'position'      => $position,
    'positionAt'    => $positionAt,
    'daily'         => $daily,
    'dailyAt'       => $dailyAt,
    'trackDays'     => $trackDays,
    'trackAt'       => $trackAt,
    'trackComplete' => $trackComplete,
]));

$payload = [
    'configured' => true,
    'position'   => $position,
    'daily'      => $daily,
];

if ($wantTrack) {
    $payload['track'] = trackPayload($trackDays, $trackComplete);
}

echo json_encode($payload, JSON_UNESCAPED_UNICODE);
