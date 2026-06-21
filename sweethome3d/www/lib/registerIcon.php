<?php
// CLI-only entry point: registers the custom sidebar icon module as a
// Lovelace resource via the Core WebSocket API. Invoked from
// rootfs/etc/cont-init.d/00-sweethome3d.sh at container startup.
require_once __DIR__ . '/LovelaceWs.php';

$url = $argv[1] ?? null;
$marker = $argv[2] ?? 'ha-sweethome3d-icons';

if (!$url) {
    fwrite(STDERR, "usage: php registerIcon.php <resource-url> [marker]\n");
    exit(1);
}

try {
    lovelace_ws_register_resource($url, $marker);
    echo "ok\n";
    exit(0);
} catch (Throwable $e) {
    fwrite(STDERR, $e->getMessage() . "\n");
    exit(1);
}
