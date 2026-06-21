<?php
// Lists Home Assistant Lovelace dashboards and their views, via the
// Core WebSocket API (no REST equivalent exists for this — see lib/LovelaceWs.php).
header('Content-Type: application/json');
require_once __DIR__ . '/lib/LovelaceWs.php';

try {
    $dashboards = lovelace_ws_list_dashboards();
    echo json_encode(['ok' => true, 'dashboards' => $dashboards]);
} catch (Throwable $e) {
    http_response_code(502);
    echo json_encode(['ok' => false, 'reason' => $e->getMessage()]);
}
