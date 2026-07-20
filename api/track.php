<?php
// Nimmt Aufrufe und Interaktionen der App entgegen und zaehlt sie zusammen.
//
// Datenschutz ist hier eine Entwurfsentscheidung, kein Nachgedanke:
//   - keine Cookies, kein localStorage  -> keine Einwilligung noetig
//   - IP-Adressen werden NIE gespeichert, nur zu einem Tageskennwert gehasht
//   - der Hash-Salt ist zufaellig und wird taeglich weggeworfen -> niemand
//     laesst sich ueber Tage hinweg wiedererkennen, auch wir nicht
//   - gespeichert werden ausschliesslich Summen pro Tag
//
// Der Ablagespeicher liegt bewusst als .php-Datei ("<?php return [...]")
// statt als .json: auf diesem Webspace laesst sich ohne .htaccess nichts vor
// direktem Abruf schuetzen, eine PHP-Datei liefert bei direktem Aufruf aber
// einfach nichts aus.

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'reason' => 'Nur POST.']);
    exit;
}

require_once __DIR__ . '/analytics-common.php';

// Grosszuegig, aber begrenzt: ein Beacon ist ein paar hundert Byte.
$raw = file_get_contents('php://input', false, null, 0, 4096);
$payload = json_decode((string) $raw, true);

if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'reason' => 'Kein JSON.']);
    exit;
}

$type = (string) ($payload['type'] ?? '');
if ($type !== 'pageview' && $type !== 'event') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'reason' => 'Unbekannter Typ.']);
    exit;
}

$lock = analyticsLock();
$store = analyticsLoad();
$today = analyticsToday();

// Tagesbucket vorbereiten
if (!isset($store['days'][$today])) {
    $store['days'][$today] = analyticsEmptyDay();
}
$day = &$store['days'][$today];

// ── Besucherkennwert (nur zum Zaehlen, nicht zum Wiedererkennen) ──
// Der Salt wechselt taeglich und wird mit dem alten Tag verworfen.
if (($store['saltDay'] ?? null) !== $today) {
    $store['salt'] = bin2hex(random_bytes(16));
    $store['saltDay'] = $today;
}

$ip = (string) ($_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? '');
$userAgent = (string) ($_SERVER['HTTP_USER_AGENT'] ?? '');
$visitorKey = substr(hash('sha256', $store['salt'] . '|' . $ip . '|' . $userAgent), 0, 16);

$surface = analyticsPick((string) ($payload['surface'] ?? ''), ['live', 'classic'], 'live');

if ($type === 'pageview') {
    // Besucher nur beim Seitenaufruf zaehlen, nicht bei Ereignissen. Sonst
    // koennte ein Ereignis ohne vorherigen Aufruf einen Besucher erfinden und
    // die Seite zeigte mehr Besucher als Aufrufe — was nicht sein kann.
    // Die Kennwerte selbst landen in einer eigenen Datei und werden nie
    // ausgeliefert; hier zaehlt nur, wie viele es sind.
    if (analyticsRegisterVisitor($today, $visitorKey)) {
        $day['visitors']++;
    }

    $day['views']++;
    $day['surfaces'][$surface] = ($day['surfaces'][$surface] ?? 0) + 1;

    $hour = (int) analyticsNow()->format('G');
    $day['hours'][(string) $hour] = ($day['hours'][(string) $hour] ?? 0) + 1;

    $device = analyticsDeviceClass($userAgent);
    $day['devices'][$device] = ($day['devices'][$device] ?? 0) + 1;

    $referrer = analyticsReferrerLabel((string) ($payload['ref'] ?? ''));
    $day['referrers'][$referrer] = ($day['referrers'][$referrer] ?? 0) + 1;
} else {
    // Nur bekannte Ereignisnamen zaehlen — sonst koennte jeder beliebige
    // Schluessel in die Ablage schreiben und sie aufblaehen.
    $name = analyticsPick((string) ($payload['name'] ?? ''), ANALYTICS_EVENTS, '');
    if ($name === '') {
        analyticsUnlock($lock);
        echo json_encode(['ok' => false, 'reason' => 'Unbekanntes Ereignis.']);
        exit;
    }
    $day['events'][$name] = ($day['events'][$name] ?? 0) + 1;
}

unset($day);
analyticsSave($store);
analyticsUnlock($lock);

echo json_encode(['ok' => true]);
