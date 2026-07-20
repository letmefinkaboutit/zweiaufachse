<?php
// Liefert die zusammengezaehlten Werte fuer /analytics.
//
// Bewusst nur Summen: der Salt und die Tageskennwerte aus track.php werden
// hier nie ausgeliefert, auch nicht versehentlich — es wird gezielt Feld fuer
// Feld zusammengesetzt statt die Ablage durchzureichen.

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache');

require_once __DIR__ . '/analytics-common.php';

$store = analyticsLoad();
$days = $store['days'] ?? [];

if (!$days) {
    echo json_encode([
        'ok'    => true,
        'leer'  => true,
        'hinweis' => 'Noch keine Aufrufe gezaehlt.',
        'tage'  => [],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

ksort($days);

$tage = [];
$summeAufrufe = 0;
$summeBesucher = 0;
$stunden = array_fill(0, 24, 0);
$geraete = [];
$ansichten = [];
$ereignisse = [];
$quellen = [];

foreach ($days as $datum => $werte) {
    $aufrufe = (int) ($werte['views'] ?? 0);
    $besucher = (int) ($werte['visitors'] ?? 0);

    $summeAufrufe += $aufrufe;
    $summeBesucher += $besucher;

    foreach (($werte['hours'] ?? []) as $stunde => $anzahl) {
        $index = (int) $stunde;
        if ($index >= 0 && $index < 24) {
            $stunden[$index] += (int) $anzahl;
        }
    }

    foreach (['devices' => &$geraete, 'surfaces' => &$ansichten, 'events' => &$ereignisse, 'referrers' => &$quellen] as $quelle => &$ziel) {
        foreach (($werte[$quelle] ?? []) as $schluessel => $anzahl) {
            $ziel[$schluessel] = ($ziel[$schluessel] ?? 0) + (int) $anzahl;
        }
    }
    unset($ziel);

    $tage[] = [
        'datum'    => (string) $datum,
        'aufrufe'  => $aufrufe,
        'besucher' => $besucher,
    ];
}

arsort($ereignisse);
arsort($quellen);
arsort($geraete);

// Reisetag zu jedem Datum, damit die Seite "Tag 3" statt nur ein Datum zeigen kann.
$tourStart = '2026-07-19';
foreach ($tage as $index => $tag) {
    $diff = (new DateTimeImmutable($tag['datum']))->diff(new DateTimeImmutable($tourStart))->days;
    $vorher = $tag['datum'] < $tourStart;
    $tage[$index]['reisetag'] = $vorher ? null : $diff + 1;
}

$heute = analyticsToday();
$heutigerTag = null;
foreach ($tage as $tag) {
    if ($tag['datum'] === $heute) {
        $heutigerTag = $tag;
    }
}

echo json_encode([
    'ok'          => true,
    'leer'        => false,
    'standVon'    => analyticsNow()->format('c'),
    'tourStart'   => $tourStart,
    'tage'        => $tage,
    'heute'       => $heutigerTag ?? ['datum' => $heute, 'aufrufe' => 0, 'besucher' => 0],
    'summe'       => [
        'aufrufe'    => $summeAufrufe,
        'besucher'   => $summeBesucher,
        'tage'       => count($tage),
        'proTag'     => count($tage) ? round($summeAufrufe / count($tage), 1) : 0,
    ],
    'stunden'     => $stunden,
    'geraete'     => $geraete,
    'ansichten'   => $ansichten,
    'ereignisse'  => $ereignisse,
    'quellen'     => array_slice($quellen, 0, 8, true),
], JSON_UNESCAPED_UNICODE);
