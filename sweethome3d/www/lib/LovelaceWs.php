<?php
// Minimal client for Home Assistant's Core WebSocket API, proxied through
// Supervisor (ws://supervisor/core/websocket). Lovelace dashboard/card
// management has no REST equivalent, so this implements just enough of
// RFC6455 (client handshake, text frames, fragmentation, ping/pong) over a
// raw stream socket to call the `lovelace/*` websocket commands needed to
// list dashboards and append a card to a view.

class LovelaceWsError extends RuntimeException
{
}

class LovelaceWsConn
{
    private $sock;
    private $buf = '';
    private $nextId = 1;

    public function __construct($sock)
    {
        $this->sock = $sock;
    }

    private function fill(): void
    {
        $chunk = fread($this->sock, 4096);
        if ($chunk === false || $chunk === '') {
            $meta = stream_get_meta_data($this->sock);
            throw new LovelaceWsError(!empty($meta['timed_out']) ? 'socket_timeout' : 'socket_closed');
        }
        $this->buf .= $chunk;
    }

    private function readExact(int $n): string
    {
        while (strlen($this->buf) < $n) {
            $this->fill();
        }
        $data = substr($this->buf, 0, $n);
        $this->buf = substr($this->buf, $n);
        return $data;
    }

    public function readUntil(string $sep): string
    {
        while (($pos = strpos($this->buf, $sep)) === false) {
            $this->fill();
        }
        $idx = $pos + strlen($sep);
        $data = substr($this->buf, 0, $idx);
        $this->buf = substr($this->buf, $idx);
        return $data;
    }

    private static function mask(string $payload, string $maskKey): string
    {
        $out = '';
        $len = strlen($payload);
        for ($i = 0; $i < $len; $i++) {
            $out .= $payload[$i] ^ $maskKey[$i % 4];
        }
        return $out;
    }

    private function sendFrame(int $opcode, string $payload): void
    {
        $length = strlen($payload);
        $maskKey = random_bytes(4);
        $header = chr(0x80 | $opcode);
        if ($length < 126) {
            $header .= chr(0x80 | $length);
        } elseif ($length < 65536) {
            $header .= chr(0x80 | 126) . pack('n', $length);
        } else {
            $header .= chr(0x80 | 127) . pack('J', $length);
        }
        $header .= $maskKey;
        fwrite($this->sock, $header . self::mask($payload, $maskKey));
    }

    public function sendText(string $text): void
    {
        $this->sendFrame(0x1, $text);
    }

    private function recvFrame(): array
    {
        [$b1, $b2] = array_map('ord', str_split($this->readExact(2)));
        $fin = ($b1 & 0x80) !== 0;
        $opcode = $b1 & 0x0F;
        $masked = ($b2 & 0x80) !== 0;
        $length = $b2 & 0x7F;
        if ($length === 126) {
            $length = unpack('n', $this->readExact(2))[1];
        } elseif ($length === 127) {
            $length = unpack('J', $this->readExact(8))[1];
        }
        $maskKey = $masked ? $this->readExact(4) : null;
        $payload = $this->readExact($length);
        if ($masked) {
            $payload = self::mask($payload, $maskKey);
        }
        return [$fin, $opcode, $payload];
    }

    public function recvMessage(): string
    {
        $chunks = [];
        while (true) {
            [$fin, $opcode, $payload] = $this->recvFrame();
            if ($opcode === 0x9) { // ping -> reply pong
                $this->sendFrame(0xA, $payload);
                continue;
            }
            if ($opcode === 0xA) { // pong, ignore
                continue;
            }
            if ($opcode === 0x8) { // close
                throw new LovelaceWsError('ws_closed_by_server');
            }
            $chunks[] = $payload;
            if ($fin) {
                break;
            }
        }
        return implode('', $chunks);
    }

    /** @return mixed */
    public function call(string $type, array $extra = [])
    {
        $msgId = $this->nextId++;
        $this->sendText(json_encode(array_merge(['id' => $msgId, 'type' => $type], $extra)));
        while (true) {
            $msg = json_decode($this->recvMessage(), true);
            if (!is_array($msg)) {
                throw new LovelaceWsError("{$type}_failed: invalid_json_response");
            }
            if (($msg['id'] ?? null) === $msgId && ($msg['type'] ?? null) === 'result') {
                if (empty($msg['success'])) {
                    $err = $msg['error'] ?? [];
                    throw new LovelaceWsError("{$type}_failed: " . ($err['message'] ?? json_encode($err)));
                }
                return $msg['result'] ?? null;
            }
            // ignore unrelated events and keep waiting for our response
        }
    }
}

function lovelace_ws_connect_and_auth(): LovelaceWsConn
{
    $token = getenv('SUPERVISOR_TOKEN');
    if (!$token) {
        throw new LovelaceWsError('SUPERVISOR_TOKEN not set');
    }

    $sock = @stream_socket_client('tcp://supervisor:80', $errno, $errstr, 8);
    if (!$sock) {
        throw new LovelaceWsError("connect_failed: {$errstr}");
    }
    stream_set_timeout($sock, 8);

    $key = base64_encode(random_bytes(16));
    $request = "GET /core/websocket HTTP/1.1\r\n" .
        "Host: supervisor\r\n" .
        "Upgrade: websocket\r\n" .
        "Connection: Upgrade\r\n" .
        "Sec-WebSocket-Key: {$key}\r\n" .
        "Sec-WebSocket-Version: 13\r\n" .
        "\r\n";
    fwrite($sock, $request);

    $conn = new LovelaceWsConn($sock);
    $statusLine = strtok($conn->readUntil("\r\n\r\n"), "\r\n");
    if (strpos($statusLine, ' 101 ') === false) {
        throw new LovelaceWsError("ws_handshake_failed: {$statusLine}");
    }

    // Supervisor proxies the raw Core websocket, so the normal
    // auth_required -> auth -> auth_ok handshake is expected. Tolerate the
    // (undocumented) possibility that Supervisor pre-authenticates the
    // tunnel and hands us an already-authenticated connection.
    $first = json_decode($conn->recvMessage(), true);
    if (($first['type'] ?? null) === 'auth_required') {
        $conn->sendText(json_encode(['type' => 'auth', 'access_token' => $token]));
        $authResult = json_decode($conn->recvMessage(), true);
        if (($authResult['type'] ?? null) !== 'auth_ok') {
            throw new LovelaceWsError('auth_failed: ' . json_encode($authResult));
        }
    } elseif (($first['type'] ?? null) !== 'auth_ok') {
        throw new LovelaceWsError('unexpected_first_message: ' . json_encode($first));
    }

    return $conn;
}

function lovelace_ws_list_dashboards(): array
{
    $conn = lovelace_ws_connect_and_auth();
    $dashboards = $conn->call('lovelace/dashboards/list') ?? [];

    $hasDefault = false;
    foreach ($dashboards as $d) {
        if (($d['url_path'] ?? null) === null) {
            $hasDefault = true;
            break;
        }
    }
    if (!$hasDefault) {
        array_unshift($dashboards, ['url_path' => null, 'title' => 'Overview']);
    }

    $result = [];
    foreach ($dashboards as $dashboard) {
        $urlPath = $dashboard['url_path'] ?? null;
        try {
            $config = $conn->call('lovelace/config', $urlPath ? ['url_path' => $urlPath] : []);
            $viewList = [];
            foreach (($config['views'] ?? []) as $i => $v) {
                $viewList[] = ['index' => $i, 'title' => $v['title'] ?? ('View ' . ($i + 1))];
            }
        } catch (LovelaceWsError $e) {
            $viewList = [];
        }
        $result[] = [
            'url_path' => $urlPath,
            'title' => $dashboard['title'] ?? 'Overview',
            'views' => $viewList,
        ];
    }
    return $result;
}

function lovelace_ws_add_card(array $args): array
{
    $urlPath = $args['url_path'] ?? null;
    $viewIndex = $args['view_index'];
    $card = $args['card'];

    $conn = lovelace_ws_connect_and_auth();
    $config = $conn->call('lovelace/config', $urlPath ? ['url_path' => $urlPath] : []);

    $views = $config['views'] ?? [];
    if ($viewIndex < 0 || $viewIndex >= count($views)) {
        return ['ok' => false, 'reason' => 'invalid_view', 'card' => $card];
    }

    $view = $views[$viewIndex];
    // Auto-generated ("strategy") dashboards and the newer "sections" view
    // layout don't render a plain appended card the way a classic
    // masonry/cards view does — bail out to the copy-paste fallback instead
    // of silently writing a card that won't show up.
    $isUnsupportedLayout = isset($config['strategy'])
        || isset($view['strategy'])
        || isset($view['sections'])
        || ($view['type'] ?? null) === 'sections';
    if ($isUnsupportedLayout) {
        return ['ok' => false, 'reason' => 'unsupported_view_layout', 'card' => $card];
    }

    if (!isset($view['cards']) || !is_array($view['cards'])) {
        $view['cards'] = [];
    }
    $view['cards'][] = $card;
    $views[$viewIndex] = $view;
    $config['views'] = $views;

    $saveArgs = ['config' => $config];
    if ($urlPath) {
        $saveArgs['url_path'] = $urlPath;
    }
    try {
        $conn->call('lovelace/config/save', $saveArgs);
    } catch (LovelaceWsError $e) {
        return ['ok' => false, 'reason' => 'save_failed: ' . $e->getMessage(), 'card' => $card];
    }

    return ['ok' => true];
}

// Registers (and refreshes) the sidebar icon module as a Lovelace resource.
// Resource management has no REST equivalent either — same WS-only situation
// as dashboards/cards above. Called from cont-init at container startup, so
// any prior entry for this module (from an older addon version) is removed
// first by matching on $marker in the resource URL.
//
// NOTE: unlike lovelace/dashboards/list, lovelace/config and
// lovelace/config/save (confirmed working against a real HA instance via the
// "Add to Dashboard" feature), the lovelace/resources* command names below
// are inferred from HA core's naming convention and have not been hands-on
// verified — confirm against a real instance the first time this runs.
function lovelace_ws_register_resource(string $url, string $marker): void
{
    $conn = lovelace_ws_connect_and_auth();

    $existing = $conn->call('lovelace/resources') ?? [];
    foreach ($existing as $resource) {
        $resUrl = $resource['url'] ?? '';
        $resId = $resource['id'] ?? null;
        if ($resId !== null && strpos($resUrl, $marker) !== false) {
            try {
                $conn->call('lovelace/resources/delete', ['resource_id' => $resId]);
            } catch (LovelaceWsError $e) {
                // Best-effort cleanup of stale entries; a leftover old entry
                // isn't fatal, so keep going and register the current one.
            }
        }
    }

    $conn->call('lovelace/resources/create', [
        'res_type' => 'module',
        'url' => $url,
    ]);
}
