<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

// Liefert die Liste der Fotos UND Videos inkl. Aufnahmedaten und
// Vorschaubildern.
// - EXIF wird pro Datei nur einmal gelesen (Cache in exif-cache.json).
// - Thumbnails (s = Grid/Kachel, l = Lightbox) werden per GD erzeugt und in
//   thumbs/ abgelegt; pro Request werden maximal MAX_THUMB_OPS neue erzeugt,
//   damit der Request nie in ein Timeout laeuft. Fehlt ein Thumbnail (noch),
//   zeigt die URL auf das Original — die App funktioniert immer.

const URL_PREFIX   = '/bilderupload/iPhone/Recents/';
// v2: Orientierungs-Heuristik gegen veraltete EXIF-Tags (Neugenerierung)
const THUMB_PREFIX = '/bilderupload/thumbs/v2/';
const THUMB_SIZES  = ['s' => 480, 'l' => 1600];
const MAX_THUMB_OPS = 12;
const JPEG_QUALITY  = 82;

const PHOTO_EXTENSIONS = ['jpg', 'jpeg'];
const VIDEO_EXTENSIONS = ['mov', 'mp4', 'm4v'];

// Ein Videobild zu ziehen dauert deutlich laenger als ein Foto zu skalieren,
// deshalb ein eigenes, knapperes Budget pro Aufruf.
const MAX_POSTER_OPS = 2;

require_once __DIR__ . '/video-meta.php';

$photoDir  = __DIR__ . '/iPhone/Recents/';
$thumbBase = __DIR__ . '/thumbs/v2';
$cacheFile = __DIR__ . '/exif-cache.json';

if (!is_dir($photoDir)) {
    echo json_encode([]);
    exit;
}

// ── EXIF-Cache laden ────────────────────────────────────
$cache = [];
if (is_file($cacheFile)) {
    $decoded = json_decode((string) @file_get_contents($cacheFile), true);
    if (is_array($decoded)) {
        $cache = $decoded;
    }
}
$cacheDirty = false;

// ── Thumb-Verzeichnisse sicherstellen ───────────────────
$thumbsWritable = true;
foreach (array_keys(THUMB_SIZES) as $sizeKey) {
    $dir = $thumbBase . '/' . $sizeKey;
    if (!is_dir($dir) && !@mkdir($dir, 0775, true)) {
        $thumbsWritable = false;
    }
}

$thumbOpsLeft  = MAX_THUMB_OPS;
$posterOpsLeft = MAX_POSTER_OPS;
$results = [];

// Vorab alle Dateinamen sammeln: fuer Live-Photo-Paare (IMG_1234.mov neben
// IMG_1234.jpg) dient das Foto als Vorschaubild des Videos — kostenlos und
// besser als jedes automatisch gezogene Einzelbild.
$photoBasenames = [];
foreach (new DirectoryIterator($photoDir) as $f) {
    if ($f->isDot() || $f->isDir()) continue;
    if (in_array(strtolower($f->getExtension()), PHOTO_EXTENSIONS, true)) {
        $photoBasenames[strtolower(pathinfo($f->getFilename(), PATHINFO_FILENAME))] = $f->getFilename();
    }
}

foreach (new DirectoryIterator($photoDir) as $file) {
    if ($file->isDot() || $file->isDir()) {
        continue;
    }

    $ext = strtolower($file->getExtension());
    $isVideo = in_array($ext, VIDEO_EXTENSIONS, true);
    if (!$isVideo && !in_array($ext, PHOTO_EXTENSIONS, true)) {
        continue;
    }

    $filename = $file->getFilename();
    $path     = $file->getPathname();
    $mtime    = $file->getMTime();
    $size     = $file->getSize();

    // Aufnahmedaten aus Cache oder frisch lesen (Videos haben kein EXIF)
    $entry = $cache[$filename] ?? null;
    if (!is_array($entry) || ($entry['mtime'] ?? null) !== $mtime || ($entry['size'] ?? null) !== $size) {
        $entry = $isVideo ? readVideoMeta($path, $mtime, $size) : readPhotoMeta($path, $mtime, $size);
        $cache[$filename] = $entry;
        $cacheDirty = true;
    }

    $originalUrl = URL_PREFIX . rawurlencode($filename);
    $urls = ['s' => null, 'l' => null];

    if ($isVideo) {
        // ── Vorschaubild fuer ein Video ──
        // Nie das Video selbst verlinken: die Galerie darf keine Videodaten
        // anfordern, bevor jemand darauf tippt. Ohne Vorschaubild bleibt
        // thumbUrl null, die App zeigt dann eine Platzhalterkachel — die
        // kostet null Bytes.
        $stem = strtolower(pathinfo($filename, PATHINFO_FILENAME));
        $posterName = $filename . '.jpg';

        // 1. Live-Photo-Paar: das gleichnamige Foto ist das beste Standbild
        //    und ist bereits skaliert vorhanden bzw. wird es gleich sein.
        $sibling = $photoBasenames[$stem] ?? null;

        foreach (THUMB_SIZES as $sizeKey => $maxDim) {
            if ($sibling !== null) {
                $siblingThumb = $thumbBase . '/' . $sizeKey . '/' . $sibling;
                if (is_file($siblingThumb)) {
                    $urls[$sizeKey] = THUMB_PREFIX . $sizeKey . '/' . rawurlencode($sibling);
                    continue;
                }
            }

            // 2. Einzelbild aus dem Video ziehen — nur wenn ffmpeg da ist.
            $posterPath = $thumbBase . '/' . $sizeKey . '/' . $posterName;
            if ($thumbsWritable && !is_file($posterPath) && $posterOpsLeft > 0 && ffmpegBinary() !== null) {
                $posterOpsLeft--;
                createVideoPoster($path, $posterPath, $maxDim);
            }
            if (is_file($posterPath)) {
                $urls[$sizeKey] = THUMB_PREFIX . $sizeKey . '/' . rawurlencode($posterName);
            }
        }

        $results[] = [
            'kind'        => 'video',
            'url'         => $originalUrl,
            'videoUrl'    => $originalUrl,
            'thumbUrl'    => $urls['s'],            // null = Platzhalter zeigen
            'lightboxUrl' => $urls['l'] ?? $urls['s'],
            'filename'    => $filename,
            'date'        => $entry['date'],
            'lat'         => $entry['lat'],
            'lon'         => $entry['lon'],
            'duration'    => $entry['duration'] ?? null,
            'sizeBytes'   => $size,
        ];
    } else {
        // Thumbnails erzeugen (budgetiert) bzw. vorhandene verlinken
        if ($thumbsWritable) {
            foreach (THUMB_SIZES as $sizeKey => $maxDim) {
                $thumbPath = $thumbBase . '/' . $sizeKey . '/' . $filename;
                if (!is_file($thumbPath) && $thumbOpsLeft > 0) {
                    $thumbOpsLeft--;
                    createThumb($path, $thumbPath, $maxDim, $entry['orientation'] ?? 1);
                }
                if (is_file($thumbPath)) {
                    $urls[$sizeKey] = THUMB_PREFIX . $sizeKey . '/' . rawurlencode($filename);
                }
            }
        }

        $results[] = [
            'kind'        => 'photo',
            'url'         => $originalUrl,
            'thumbUrl'    => $urls['s'] ?? $originalUrl,
            'lightboxUrl' => $urls['l'] ?? $originalUrl,
            'filename'    => $filename,
            'date'        => $entry['date'],
            'lat'         => $entry['lat'],
            'lon'         => $entry['lon'],
        ];
    }
}

// Verwaiste Cache-Eintraege (geloeschte Fotos) entfernen
$existing = array_column($results, 'filename');
foreach (array_diff(array_keys($cache), $existing) as $orphan) {
    unset($cache[$orphan]);
    $cacheDirty = true;
}

if ($cacheDirty) {
    @file_put_contents($cacheFile, json_encode($cache, JSON_UNESCAPED_UNICODE));
}

usort($results, function ($a, $b) {
    if ($a['date'] === null && $b['date'] === null) {
        return 0;
    }
    if ($a['date'] === null) {
        return 1;
    }
    if ($b['date'] === null) {
        return -1;
    }
    return strcmp($b['date'], $a['date']);
});

echo json_encode($results, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

// ── Helfer ──────────────────────────────────────────────

function readPhotoMeta(string $path, int $mtime, int $size): array
{
    $date = null;
    $lat  = null;
    $lon  = null;
    $orientation = 1;

    // Wie bei GD weiter unten: fehlt die Erweiterung, liefern wir lieber eine
    // Liste ohne Aufnahmedaten als einen Fehler fuer die ganze Galerie.
    $exif = function_exists('exif_read_data') ? @exif_read_data($path) : false;

    if ($exif) {
        if (!empty($exif['DateTimeOriginal'])) {
            $parts    = explode(' ', $exif['DateTimeOriginal'], 2);
            $datePart = str_replace(':', '-', $parts[0]);
            $timePart = $parts[1] ?? '00:00:00';
            $date     = $datePart . 'T' . $timePart;
        }

        if (!empty($exif['GPSLatitude']) && !empty($exif['GPSLongitude'])) {
            $lat = gpsToDecimal($exif['GPSLatitude'], $exif['GPSLatitudeRef'] ?? 'N');
            $lon = gpsToDecimal($exif['GPSLongitude'], $exif['GPSLongitudeRef'] ?? 'E');
        }

        if (!empty($exif['Orientation'])) {
            $orientation = (int) $exif['Orientation'];
        }
    }

    return [
        'mtime'       => $mtime,
        'size'        => $size,
        'date'        => $date,
        'lat'         => $lat,
        'lon'         => $lon,
        'orientation' => $orientation,
    ];
}

function createThumb(string $srcPath, string $dstPath, int $maxDim, int $orientation): void
{
    if (!function_exists('imagecreatefromjpeg')) {
        return;
    }

    $info = @getimagesize($srcPath);
    if (!$info) {
        return;
    }
    [$width, $height] = $info;

    // 12-MP-iPhone-Fotos brauchen beim Dekodieren viel Speicher
    @ini_set('memory_limit', '512M');

    $src = @imagecreatefromjpeg($srcPath);
    if (!$src) {
        return;
    }

    // EXIF-Orientierung einbacken — Thumbnails verlieren die EXIF-Daten,
    // daher muss die Drehung im Pixelbild landen.
    // Heuristik: Tag 6/8 gehoert zu quer gespeicherten Sensor-Pixeln.
    // Sind die Rohpixel schon hochkant, ist das Tag veraltet (Pixel wurden
    // beim Uebertragen bereits gedreht) — dann NICHT nochmal drehen.
    if ($orientation === 3) {
        $src = imagerotate($src, 180, 0);
    } elseif (($orientation === 6 || $orientation === 8) && $width > $height) {
        $src = imagerotate($src, $orientation === 6 ? -90 : 90, 0);
        [$width, $height] = [$height, $width];
    }

    $scale = min(1.0, $maxDim / max($width, $height));
    $dstW  = max(1, (int) round($width * $scale));
    $dstH  = max(1, (int) round($height * $scale));

    if ($scale >= 1.0) {
        // Original ist schon klein genug — direkt (ggf. gedreht) speichern
        imagejpeg($src, $dstPath, JPEG_QUALITY);
        imagedestroy($src);
        return;
    }

    $dst = imagecreatetruecolor($dstW, $dstH);
    imagecopyresampled($dst, $src, 0, 0, 0, 0, $dstW, $dstH, $width, $height);
    imagejpeg($dst, $dstPath, JPEG_QUALITY);
    imagedestroy($dst);
    imagedestroy($src);
}

function gpsToDecimal(array $gps, string $ref): float
{
    $parts = array_map(function ($frac) {
        $split = explode('/', $frac);
        return count($split) === 2 ? (float) $split[0] / max(1, (float) $split[1]) : (float) $frac;
    }, $gps);

    $decimal = ($parts[0] ?? 0) + ($parts[1] ?? 0) / 60 + ($parts[2] ?? 0) / 3600;

    if ($ref === 'S' || $ref === 'W') {
        $decimal *= -1;
    }

    return round($decimal, 6);
}
