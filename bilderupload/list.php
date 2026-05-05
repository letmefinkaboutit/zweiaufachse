<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$dir = __DIR__ . '/iPhone/Recents/';
$results = [];

if (!is_dir($dir)) {
    echo json_encode([]);
    exit;
}

foreach (new DirectoryIterator($dir) as $file) {
    if ($file->isDot() || $file->isDir()) {
        continue;
    }

    $ext = strtolower($file->getExtension());
    if (!in_array($ext, ['jpg', 'jpeg'])) {
        continue;
    }

    $path  = $file->getPathname();
    $url   = '/bilderupload/iPhone/Recents/' . rawurlencode($file->getFilename());
    $date  = null;
    $lat   = null;
    $lon   = null;

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
    }

    $results[] = [
        'url'      => $url,
        'filename' => $file->getFilename(),
        'date'     => $date,
        'lat'      => $lat,
        'lon'      => $lon,
    ];
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
