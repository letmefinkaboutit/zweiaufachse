<?php
// Gemeinsamer Unterbau fuer track.php (schreibt) und analytics.php (liest).

const ANALYTICS_TIMEZONE = 'Europe/Berlin';

// Ablage als PHP-Datei, damit ein direkter Abruf nichts ausliefert.
const ANALYTICS_STORE   = __DIR__ . '/analytics-store.php';
const ANALYTICS_VISITORS = __DIR__ . '/analytics-visitors.php';

// So viele Tage bleiben erhalten. Die Reise dauert Wochen, nicht Jahre.
const ANALYTICS_KEEP_DAYS = 180;

// Obergrenze pro Tag, damit die Besucherdatei nicht unbegrenzt waechst.
const ANALYTICS_MAX_VISITORS_PER_DAY = 20000;

// Erlaubte Ereignisnamen. Alles andere wird verworfen — sonst koennte jeder
// beliebige Schluessel in die Ablage schreiben.
const ANALYTICS_EVENTS = [
    'karte',          // grosse Karte geoeffnet
    'album',          // Fotoalbum geoeffnet
    'foto',           // Foto gross angesehen (Lightbox)
    'tourstatus',     // Hoehenprofil / Etappen
    'strava',         // Gesundheits- und Strava-Werte
    'klassisch',      // in die klassische Ansicht gewechselt
    'zurueck-live',   // aus der klassischen Ansicht zurueck
];

function analyticsNow(): DateTimeImmutable
{
    return new DateTimeImmutable('now', new DateTimeZone(ANALYTICS_TIMEZONE));
}

function analyticsToday(): string
{
    return analyticsNow()->format('Y-m-d');
}

function analyticsEmptyDay(): array
{
    return [
        'views'     => 0,
        'visitors'  => 0,
        'hours'     => [],
        'surfaces'  => [],
        'devices'   => [],
        'events'    => [],
        'referrers' => [],
    ];
}

// Nur Werte aus einer bekannten Liste durchlassen.
function analyticsPick(string $value, array $allowed, string $fallback): string
{
    return in_array($value, $allowed, true) ? $value : $fallback;
}

function analyticsDeviceClass(string $userAgent): string
{
    if ($userAgent === '') {
        return 'unbekannt';
    }
    if (preg_match('/iPad|Tablet|PlayBook|Silk/i', $userAgent)) {
        return 'tablet';
    }
    if (preg_match('/Mobi|Android|iPhone|iPod|Windows Phone/i', $userAgent)) {
        return 'handy';
    }
    return 'rechner';
}

// Nur die Quelle grob einordnen — die volle URL wird nicht gespeichert.
function analyticsReferrerLabel(string $referrer): string
{
    if ($referrer === '') {
        return 'direkt';
    }

    $host = strtolower((string) (parse_url($referrer, PHP_URL_HOST) ?? ''));
    if ($host === '') {
        return 'direkt';
    }

    // Eigene Domains zaehlen nicht als Verweis.
    if (str_contains($host, 'zweiaufachse.thefinks.de') || str_contains($host, 'ride2volos')) {
        return 'intern';
    }

    $known = [
        'whatsapp'  => 'WhatsApp',
        'instagram' => 'Instagram',
        'facebook'  => 'Facebook',
        'fb.'       => 'Facebook',
        'google'    => 'Google',
        'telegram'  => 'Telegram',
        't.co'      => 'X/Twitter',
        'linkedin'  => 'LinkedIn',
        'strava'    => 'Strava',
    ];

    foreach ($known as $needle => $label) {
        if (str_contains($host, $needle)) {
            return $label;
        }
    }

    // Unbekannte Quellen nur als Hostname, ohne Pfad oder Parameter.
    return mb_substr($host, 0, 40);
}

// Zwei Aufrufe gleichzeitig wuerden sich sonst gegenseitig ueberschreiben:
// beide lesen denselben Stand, beide zaehlen hoch, der zweite gewinnt und ein
// Aufruf geht verloren. Deshalb Lesen-Aendern-Schreiben unter einer Sperre.
function analyticsLock()
{
    $handle = @fopen(__DIR__ . '/analytics.lock', 'c');
    if ($handle === false) {
        return null;
    }
    @flock($handle, LOCK_EX);
    return $handle;
}

function analyticsUnlock($handle): void
{
    if ($handle) {
        @flock($handle, LOCK_UN);
        @fclose($handle);
    }
}

function analyticsLoad(): array
{
    $store = is_file(ANALYTICS_STORE) ? @include ANALYTICS_STORE : null;

    if (!is_array($store) || !isset($store['days']) || !is_array($store['days'])) {
        $store = ['days' => [], 'salt' => '', 'saltDay' => null];
    }

    return $store;
}

function analyticsWritePhp(string $file, array $data): void
{
    $code = "<?php\n// Automatisch erzeugt — nicht von Hand bearbeiten.\nreturn "
        . var_export($data, true) . ";\n";

    // Erst daneben schreiben, dann umbenennen: ein gleichzeitiger Leser sieht
    // nie eine halb geschriebene Datei.
    $tmp = $file . '.tmp' . getmypid();
    if (@file_put_contents($tmp, $code, LOCK_EX) !== false) {
        @rename($tmp, $file);
    }
}

function analyticsSave(array $store): void
{
    // Alte Tage wegwerfen.
    $cutoff = analyticsNow()->modify('-' . ANALYTICS_KEEP_DAYS . ' days')->format('Y-m-d');
    foreach (array_keys($store['days']) as $day) {
        if ((string) $day < $cutoff) {
            unset($store['days'][$day]);
        }
    }

    krsort($store['days']);
    analyticsWritePhp(ANALYTICS_STORE, $store);
}

// Merkt sich die Tageskennwerte getrennt von den Summen. Gibt true zurueck,
// wenn dieser Kennwert heute noch nicht gesehen wurde.
function analyticsRegisterVisitor(string $day, string $key): bool
{
    $data = is_file(ANALYTICS_VISITORS) ? @include ANALYTICS_VISITORS : null;
    if (!is_array($data)) {
        $data = [];
    }

    // Nur den aktuellen Tag behalten — aeltere Kennwerte braucht niemand mehr.
    if (!isset($data[$day])) {
        $data = [$day => []];
    }

    if (isset($data[$day][$key])) {
        return false;
    }

    if (count($data[$day]) >= ANALYTICS_MAX_VISITORS_PER_DAY) {
        return false;
    }

    $data[$day][$key] = 1;
    analyticsWritePhp(ANALYTICS_VISITORS, $data);

    return true;
}
