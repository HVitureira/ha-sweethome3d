<?php
  /*
   * haConfigStatus.php — privacy-safe probe of the add-on's ha-config.json
   *
   * Returns JSON: { "hasAddress": bool, "hasToken": bool }
   *
   * Never returns the token or address values themselves. Used by the Vue
   * frontend to mirror what Unity's index.html does — fall back to the
   * add-on options file (written at container start by 00-sweethome3d.sh
   * from the add-on's `homeassistant_token`/`homeassistant_address`
   * options) when localStorage has no per-browser token.
   *
   * Mirrors the file-reading logic of haApiProxy.php (Strategy 2) and
   * WebGLConfigurationManager's CreateFallbackConfiguration, so the
   * token-missing banner matches Unity's actual connection behavior.
   */

  header('Content-Type: application/json');

  // Same lookup order as haApiProxy.php: production writes to
  // /var/www/html/ha-config.json (next to this script); local Docker
  // also serves it from the same dir.
  $configFile = __DIR__ . '/ha-config.json';

  $hasAddress = false;
  $hasToken   = false;

  if (file_exists($configFile)) {
    $config = json_decode(file_get_contents($configFile), true);
    if (is_array($config)) {
      $address = $config['homeAssistantAddress'] ?? '';
      $token   = $config['homeAssistantAccessToken'] ?? '';
      $hasAddress = ($address !== '' && $address !== null);
      $hasToken   = ($token   !== '' && $token   !== null);
    }
  }

  echo json_encode([
    'hasAddress' => $hasAddress,
    'hasToken'   => $hasToken,
  ]);