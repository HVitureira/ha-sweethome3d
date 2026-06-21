<?php
// Adds an iframe card showing the Unity 3D scene of the given home to a
// chosen Home Assistant Lovelace dashboard/view, via the Core WebSocket API
// (no REST equivalent exists for Lovelace config — see lib/LovelaceWs.php).
//
// POST JSON body: { "homeId": "...", "urlPath": "..."|null, "viewIndex": 0 }
header('Content-Type: application/json');
require_once __DIR__ . '/lib/LovelaceWs.php';

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'reason' => 'invalid_body']);
    exit;
}

$homeId = $body['homeId'] ?? null;
$urlPath = $body['urlPath'] ?? null;
$viewIndex = $body['viewIndex'] ?? null;

if (!is_string($homeId) || !preg_match('/^[A-Za-z0-9_-]+$/', $homeId)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'reason' => 'invalid_home_id']);
    exit;
}
if (!is_int($viewIndex)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'reason' => 'invalid_view_index']);
    exit;
}

$supervisorToken = getenv('SUPERVISOR_TOKEN');
if (!$supervisorToken) {
    http_response_code(503);
    echo json_encode(['ok' => false, 'reason' => 'no_supervisor_token']);
    exit;
}

// Resolve the addon's stable ingress path so the card works from inside
// the Home Assistant frontend (raw :8099 is a different, unreachable origin).
$ch = curl_init('http://supervisor/addons/self/info');
curl_setopt_array($ch, [
    CURLOPT_HTTPHEADER     => ["Authorization: Bearer $supervisorToken"],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 10,
]);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200 || !$response) {
    http_response_code(502);
    echo json_encode(['ok' => false, 'reason' => 'addon_info_failed']);
    exit;
}

$info = json_decode($response, true);
$ingressEntry = $info['data']['ingress_entry'] ?? $info['ingress_entry'] ?? null;
if (!$ingressEntry) {
    http_response_code(502);
    echo json_encode(['ok' => false, 'reason' => 'no_ingress_entry']);
    exit;
}

$card = [
    'type'         => 'iframe',
    'url'          => $ingressEntry . '/unity-visualizer/index.html?homeId=' . rawurlencode($homeId),
    'title'        => 'Home 3D View — ' . $homeId,
    'aspect_ratio' => '75%',
];

try {
    $result = lovelace_ws_add_card([
        'url_path'   => $urlPath,
        'view_index' => $viewIndex,
        'card'       => $card,
    ]);
} catch (Throwable $e) {
    http_response_code(502);
    echo json_encode(['ok' => false, 'reason' => $e->getMessage(), 'card' => $card]);
    exit;
}

if (!($result['ok'] ?? false)) {
    // Fall back: hand the frontend the card config so it can offer a
    // copy-paste path (YAML-mode dashboard, sections layout, WS failure, etc).
    $result['card'] = $result['card'] ?? $card;
    echo json_encode($result);
    exit;
}

echo json_encode(['ok' => true]);
