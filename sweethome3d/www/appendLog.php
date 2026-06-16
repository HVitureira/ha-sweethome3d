<?php
// appendLog.php — appends a batch of log lines (POST body) to a persistent log file.
// In the HA add-on /share is mounted rw and exposed by the Samba add-on.
// In local Docker the test-data volume is used as a fallback.
if (is_dir('/share')) {
    $logDir = '/share/latency-logs';
} else {
    $logDir = is_dir('/data/homes') ? '/data/homes' : 'data';
}

if (!is_dir($logDir)) {
    mkdir($logDir, 0755, true);
}

$path     = isset($_GET['path']) ? basename($_GET['path']) : 'latency.log';
$dataFile = $logDir . '/' . $path;

$body = file_get_contents('php://input');
if ($body === false || $body === '') {
    http_response_code(400);
    exit;
}

$fp = fopen($dataFile, 'a');
if ($fp) {
    flock($fp, LOCK_EX);
    fwrite($fp, $body);
    flock($fp, LOCK_UN);
    fclose($fp);
    http_response_code(200);
} else {
    http_response_code(500);
}
?>
