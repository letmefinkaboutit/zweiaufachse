<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

// Liefert die Fotoliste inkl. EXIF-Daten und Thumbnail-URLs.
// - EXIF wird pro Datei nur einmal gelesen (Cache in exif-cache.json).
// - Thumbnails (s = Grid/Kachel, l = Lightbox) werden per GD erzeugt und in
//   thumbs/ abgelegt; pro Request werden maximal MAX_THUMB_OPS neue erzeugt,
//   damit der Request nie in ein Timeout laeuft. Fehlt ein Thumbnail (noch),
//   zeigt die URL auf das Original — die App funktioniert immer.

const URL_PREFIX   = '/bilderupload/iPhone/Recents/';
const THUMB_PREFIX = '/bilderupload/thumbs/';
const THUMB_SIZES  = ['s' => 480, 'l' => 1600];
const MAX_THUMB_OPS = 12;
const JPEG_QUALITY  = 82;

$photoDir  = __DIR__ . '/iPhone/Recents/';
$thumbBase = __DIR__ . '/thumbs';
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

$thumbOpsLeft = MAX_THUMB_OPS;
$results = [];

foreach (new DirectoryIterator($photoDir) as $file) {
    if ($file->isDot() || $file->isDir()) {
        continue;
    }

    $ext = strtolower($file->getExtension());
    if (!in_array($ext, ['jpg', 'jpeg'])) {
        continue;
    }

    $filename = $file->getFilename();
    $path     = $file->getPathname();
    $mtime    = $file->getMTime();
    $size     = $file->getSize();

    // EXIF aus Cache oder frisch lesen
    $entry = $cache[$filename] ?? null;
    if (!is_array($entry) || ($entry['mtime'] ?? null) !== $mtime || ($entry['size'] ?? null) !== $size) {
        $entry = readPhotoMeta($path, $mtime, $size);
        $cache[$filename] = $entry;
        $cacheDirty = true;
    }

    // Thumbnails erzeugen (budgetiert) bzw. vorhandene verlinken
    $urls = ['s' => null, 'l' => null];
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

    $originalUrl = URL_PREFIX . rawurlencode($filename);

    $results[] = [
        'url'         => $originalUrl,
        'thumbUrl'    => $urls['s'] ?? $originalUrl,
        'lightboxUrl' => $urls['l'] ?? $originalUrl,
        'filename'    => $filename,
        'date'        => $entry['date'],
        'lat'         => $entry['lat'],
        'lon'         => $entry['lon'],
    ];
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

    $exif = @exif_read_data($path);

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
    if ($orientation === 3) {
        $src = imagerotate($src, 180, 0);
    } elseif ($orientation === 6) {
        $src = imagerotate($src, -90, 0);
        [$width, $height] = [$height, $width];
    } elseif ($orientation === 8) {
        $src = imagerotate($src, 90, 0);
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
