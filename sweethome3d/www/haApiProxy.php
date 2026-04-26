<?php
// Proxy HA Core API requests for the entity selector.
//
// Strategy 1 (production): Use SUPERVISOR_TOKEN to call the Supervisor internal API.
// Strategy 2 (local Docker): Read ha-config.json and call HA directly.

header('Content-Type: application/json');

// --- Strategy 1: HA Addon (SUPERVISOR_TOKEN available) ---
$supervisorToken = getenv('SUPERVISOR_TOKEN');
if ($supervisorToken) {
    $ch = curl_init('http://supervisor/core/api/states');
    curl_setopt_array($ch, [
        CURLOPT_HTTPHEADER     => ["Authorization: Bearer $supervisorToken", 'Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    http_response_code($httpCode ?: 502);
    echo $response ?: '[]';
    exit;
}

// --- Strategy 2: Local Docker / standalone (read ha-config.json) ---
$configFile = __DIR__ . '/ha-config.json';
if (!file_exists($configFile)) {
    http_response_code(503);
    echo json_encode(['error' => 'No SUPERVISOR_TOKEN and no ha-config.json found']);
    exit;
}

$config = json_decode(file_get_contents($configFile), true);
$address = $config['homeAssistantAddress'] ?? '';
$token   = $config['homeAssistantAccessToken'] ?? '';
$useSSL  = $config['useSSL'] ?? true;

if (!$address || !$token) {
    http_response_code(503);
    echo json_encode(['error' => 'HA address or token not configured in ha-config.json']);
    exit;
}

$proto = $useSSL ? 'https' : 'http';
$url   = "$proto://$address/api/states";

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_HTTPHEADER     => ["Authorization: Bearer $token", 'Content-Type: application/json'],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 10,
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_SSL_VERIFYHOST => false,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

if ($curlErr) {
    http_response_code(502);
    echo json_encode(['error' => "Cannot reach HA at $address: $curlErr"]);
    exit;
}

http_response_code($httpCode ?: 502);
echo $response ?: '[]';
