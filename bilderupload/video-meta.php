<?php
// Liest Aufnahmedatum, Standort und Laenge aus MOV/MP4 — ohne ffmpeg.
//
// Videos haben kein EXIF. Die Angaben stecken in der Atom-Struktur von
// QuickTime/MP4:
//   moov > mvhd            Erstellzeit (Sekunden seit 1904) und Laenge
//   moov > udta > ©xyz     Standort als ISO-6709-String
//   moov > udta > meta     Apples Aufnahmedatum MIT Zeitzone
//
// Gelesen wird nur der moov-Kopf, nie die Videodaten selbst — auch ein
// 500-MB-Clip kostet hier nur ein paar Kilobyte.

// Mehr als das braucht kein Kopfbereich; bei langen Videos sind die
// Sample-Tabellen darin gross, die interessieren uns aber nicht.
const VIDEO_MOOV_MAX_READ = 1048576;   // 1 MB

// Zeitrechnung von QuickTime beginnt 1904, Unix 1970.
const QT_EPOCH_OFFSET = 2082844800;

// Nur als Rueckfall, wenn im Video keine Zeitzone steht (siehe unten).
const VIDEO_FALLBACK_TIMEZONE = 'Europe/Berlin';

// Sucht ein Atom auf einer Ebene und liefert [Offset des Inhalts, Laenge].
function qtFindAtom($handle, int $start, int $end, string $wanted): ?array
{
    $offset = $start;

    while ($offset + 8 <= $end) {
        if (fseek($handle, $offset) !== 0) {
            return null;
        }
        $header = fread($handle, 8);
        if ($header === false || strlen($header) < 8) {
            return null;
        }

        $parts = unpack('Nsize/a4type', $header);
        $size = $parts['size'];
        $type = $parts['type'];
        $headerLength = 8;

        if ($size === 1) {
            // 64-Bit-Laenge steht direkt hinter dem Kopf
            $extended = fread($handle, 8);
            if ($extended === false || strlen($extended) < 8) {
                return null;
            }
            $high = unpack('N', substr($extended, 0, 4))[1];
            $low  = unpack('N', substr($extended, 4, 4))[1];
            $size = ($high << 32) | $low;
            $headerLength = 16;
        } elseif ($size === 0) {
            $size = $end - $offset;   // bis zum Ende
        }

        if ($size < $headerLength) {
            return null;              // kaputte Struktur, nicht weiterlaufen
        }

        if ($type === $wanted) {
            return [$offset + $headerLength, $size - $headerLength];
        }

        $offset += $size;
    }

    return null;
}

function readVideoMeta(string $path, int $mtime, int $size): array
{
    $meta = [
        'mtime'    => $mtime,
        'size'     => $size,
        'date'     => null,
        'lat'      => null,
        'lon'      => null,
        'duration' => null,
        'kind'     => 'video',
        'dateSource' => 'dateizeit',
    ];

    $handle = @fopen($path, 'rb');
    if (!$handle) {
        return $meta;
    }

    $moov = qtFindAtom($handle, 0, $size, 'moov');

    if ($moov) {
        [$moovStart, $moovSize] = $moov;

        // ── Laenge und Erstellzeit aus mvhd ──
        $mvhd = qtFindAtom($handle, $moovStart, $moovStart + $moovSize, 'mvhd');
        if ($mvhd) {
            fseek($handle, $mvhd[0]);
            $version = ord((string) fread($handle, 1));
            fread($handle, 3);   // Flags

            if ($version === 1) {
                $created = unpack('J', (string) fread($handle, 8))[1];
                fread($handle, 8);   // Aenderungszeit
                $timescale = unpack('N', (string) fread($handle, 4))[1];
                $duration  = unpack('J', (string) fread($handle, 8))[1];
            } else {
                $created = unpack('N', (string) fread($handle, 4))[1];
                fread($handle, 4);
                $timescale = unpack('N', (string) fread($handle, 4))[1];
                $duration  = unpack('N', (string) fread($handle, 4))[1];
            }

            if ($timescale > 0 && $duration > 0) {
                $meta['duration'] = round($duration / $timescale, 1);
            }

            $unix = $created - QT_EPOCH_OFFSET;
            // Vor 2000 ist die Angabe unbrauchbar (manche Kameras lassen sie leer).
            if ($unix > 946684800) {
                // mvhd fuehrt UTC, die Fotos daneben aber Ortszeit. Ohne
                // Umrechnung staende ein 00:30-Video vom Vortag im falschen
                // Tagesabschnitt. Zeitzone der Reise als beste Schaetzung —
                // in Griechenland (UTC+3) ist das eine Stunde daneben, aber
                // deutlich naeher dran als reines UTC. Sobald Apples
                // Aufnahmedatum vorliegt, gewinnt ohnehin dieses.
                $meta['date'] = (new DateTimeImmutable('@' . $unix))
                    ->setTimezone(new DateTimeZone(VIDEO_FALLBACK_TIMEZONE))
                    ->format('Y-m-d\TH:i:s');
                $meta['dateSource'] = 'mvhd-utc-geschaetzt';
            }
        }

        // ── Standort und Apples Datum aus dem Kopfbereich ──
        // Statt udta/meta/keys/ilst nachzubauen (drei ineinandergeschachtelte
        // Tabellen fuer zwei Werte) wird der Kopfbereich nach den beiden
        // eindeutigen Mustern durchsucht. Beide Formate sind so spezifisch,
        // dass eine Verwechslung praktisch ausgeschlossen ist.
        fseek($handle, $moovStart);
        $head = (string) fread($handle, min($moovSize, VIDEO_MOOV_MAX_READ));

        // Apples Aufnahmedatum bringt die Zeitzone mit. Das ist der beste Wert,
        // den es gibt: Fotos werden per EXIF in ORTSZEIT gefuehrt, und die
        // Galerie gruppiert nach Kalendertag — ein abends aufgenommenes Video
        // wuerde in UTC sonst auf den Vortag rutschen.
        // Der Bruchteil hinter den Sekunden ist optional (ffmpeg schreibt ihn,
        // iPhones nicht) und darf den Ausdruck nicht scheitern lassen.
        if (preg_match('/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.\d+)?([+-]\d{2}:?\d{2})/', $head, $m)) {
            try {
                $offset = str_replace(':', '', $m[2]);
                $when = new DateTimeImmutable($m[1] . $offset);
                $meta['date'] = $when
                    ->setTimezone(new DateTimeZone(substr($offset, 0, 3) . ':' . substr($offset, 3, 2)))
                    ->format('Y-m-d\TH:i:s');
                $meta['dateSource'] = 'quicktime-lokal';
            } catch (Exception $e) {
                // mvhd-Wert behalten
            }
        }

        // ISO 6709: +48.0614+010.6777/ (optional mit Hoehe)
        if (preg_match('#([+-]\d{1,2}\.\d+)([+-]\d{1,3}\.\d+)#', $head, $m)) {
            $lat = (float) $m[1];
            $lon = (float) $m[2];
            if ($lat >= -90 && $lat <= 90 && $lon >= -180 && $lon <= 180 && ($lat !== 0.0 || $lon !== 0.0)) {
                $meta['lat'] = round($lat, 6);
                $meta['lon'] = round($lon, 6);
            }
        }
    }

    fclose($handle);

    // Ohne verwertbares Datum bleibt die Dateizeit — besser als gar keine
    // Einordnung, die Galerie gruppiert schliesslich nach Tagen.
    if ($meta['date'] === null) {
        $meta['date'] = date('Y-m-d\TH:i:s', $mtime);
    }

    return $meta;
}

// ffmpeg ist auf einfachem Webspace fast nie vorhanden und exec meist
// gesperrt. Deshalb: einmal vorsichtig nachsehen, Ergebnis merken, und ohne
// ffmpeg einfach ohne Vorschaubild weitermachen.
function ffmpegBinary(): ?string
{
    static $resolved = false;
    static $binary = null;

    if ($resolved) {
        return $binary;
    }
    $resolved = true;

    $disabled = array_map('trim', explode(',', (string) ini_get('disable_functions')));
    if (in_array('shell_exec', $disabled, true) || !function_exists('shell_exec')) {
        return $binary = null;
    }

    foreach (['ffmpeg', '/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg'] as $candidate) {
        $out = @shell_exec(escapeshellcmd($candidate) . ' -version 2>/dev/null');
        if (is_string($out) && str_contains($out, 'ffmpeg version')) {
            return $binary = $candidate;
        }
    }

    return $binary = null;
}

// Einzelbild aus dem Video ziehen. Liefert false, wenn es nicht geht —
// dann zeigt die Galerie eine Platzhalterkachel statt eines Vorschaubilds.
function createVideoPoster(string $srcPath, string $dstPath, int $maxDim): bool
{
    $binary = ffmpegBinary();
    if ($binary === null) {
        return false;
    }

    $command = sprintf(
        '%s -ss 00:00:01 -i %s -frames:v 1 -vf %s -q:v 4 -y %s 2>/dev/null',
        escapeshellcmd($binary),
        escapeshellarg($srcPath),
        escapeshellarg("scale='min({$maxDim},iw)':-2"),
        escapeshellarg($dstPath)
    );

    @shell_exec($command);

    return is_file($dstPath) && filesize($dstPath) > 0;
}
