# Testing the Entity Selector (HA API Integration)

The entity selector in the furniture dialog fetches entities from the Home Assistant
REST API (`/api/states`) and presents them in a searchable dropdown.

There are **three ways to test**, depending on your environment.

---

## 1. Vite Dev Server (no Docker)

The Vite dev middleware proxies `/haApiProxy.php` to your real HA instance
using credentials you provide.

### Option A — Settings tab (recommended)

1. Run `npm run dev` from `www-vue/`
2. Open the app in the browser
3. Go to the **Settings** tab
4. Enter your HA address (e.g. `homeassistant.local:8123`) and a
   [long-lived access token](https://developers.home-assistant.io/docs/auth_api/#long-lived-access-tokens)
5. Open a furniture dialog on a smart device — the entity dropdown should populate

The credentials are stored in `localStorage` under the key `ha-smart-home-settings`.
The frontend sends them to the Vite proxy via `X-HA-Address` / `X-HA-Token` headers.

### Option B — ha-config.json file

If you don't want to use the Settings UI, create `test-data/ha-config.json`:

```json
{
  "homeAssistantAddress": "homeassistant.local:8123",
  "homeAssistantAccessToken": "YOUR_LONG_LIVED_TOKEN",
  "useSSL": true,
  "source": "addon-options"
}
```

The Vite middleware reads this as a fallback when no `X-HA-*` headers are present.

> **Note:** `test-data/ha-config.json` is git-ignored and never committed —
> it may contain secrets.

---

## 2. Docker Compose (local container, no Home Assistant)

This simulates the addon container locally. The PHP proxy
will attempt to reach `http://supervisor/core/api/states` using `SUPERVISOR_TOKEN`,
which doesn't exist outside HA — so the proxy returns `503`.

To test with a **real HA instance**, pass the credentials as addon options:

1. Copy the example config:
   ```bash
   cp test-config.example test-config.local
   ```

2. Edit `test-config.local` with your HA details:
   ```json
   {
     "php_max_execution_time": 300,
     "php_memory_limit": "256M",
     "php_upload_max_filesize": "200M",
     "php_post_max_size": "200M",
     "homeassistant_address": "192.168.1.100:8123",
     "homeassistant_token": "YOUR_LONG_LIVED_TOKEN",
       "use_ssl": true
   }
   ```

3. Build & run:
   ```bash
   docker-compose up --build
   ```

4. Open `http://localhost:8099`

In this mode, `start.sh` transforms `test-config.local` (mounted as
`/data/options.json`) into `/var/www/html/ha-config.json`. The frontend's
`settingsStore` reads `ha-config.json` and populates `localStorage`.

However, the PHP proxy (`haApiProxy.php`) still relies on `SUPERVISOR_TOKEN`
which isn't set. To work around this, you can override the env var:

```yaml
# docker-compose.yml — add under environment:
environment:
  - OPTIONS_JSON=/data/options.json
  - SUPERVISOR_TOKEN=YOUR_LONG_LIVED_TOKEN
```

> **Warning:** `SUPERVISOR_TOKEN` in a real addon is managed by HA and talks to
> `http://supervisor/...`. When faking it, the PHP proxy will try to reach
> `http://supervisor/core/api/states` which doesn't exist. You need to also
> override the proxy target. See section below.

### Overriding the PHP proxy target for local Docker testing

Edit `haApiProxy.php` temporarily (or create a local override) to point at
your HA instance directly:

```php
// Instead of:
$ch = curl_init('http://supervisor/core/api/states');
// Use:
$ch = curl_init('https://YOUR_HA_ADDRESS/api/states');
// And use your long-lived token instead of SUPERVISOR_TOKEN:
$token = getenv('SUPERVISOR_TOKEN') ?: 'YOUR_LONG_LIVED_TOKEN';
```

This is only for local testing — never commit these changes.

---

## 3. Home Assistant Addon (production)

In production, everything is automatic:

1. The addon's `config.yaml` declares `homeassistant_api: true` and
   `hassio_api: true`, so the HA Supervisor injects `SUPERVISOR_TOKEN`
   into the container environment.

2. The init script (`00-sweethome3d.sh`) generates `ha-config.json`
   from the addon options and auto-detects the HA address via the
   Supervisor API.

3. The PHP proxy (`haApiProxy.php`) uses `SUPERVISOR_TOKEN` to call
   `http://supervisor/core/api/states` — this is the HA internal API,
   same-origin, no CORS.

4. The frontend calls `/haApiProxy.php` and gets the full entity list.

**No additional configuration needed.** The entity selector works
out of the box once the addon is installed.

---

## Generating a Long-Lived Access Token

1. In Home Assistant, go to your **Profile** (bottom-left)
2. Scroll to **Long-Lived Access Tokens**
3. Click **Create Token**, give it a name (e.g. "SweetHome3D Dev")
4. Copy the token — it's only shown once

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Warning icon (⚠) next to input | HA unreachable or bad credentials | Check address/token in Settings tab |
| "No HA credentials" in dropdown | No address or token configured | Enter them in Settings or ha-config.json |
| "Cannot reach HA at ..." | Network issue or wrong address | Verify HA is reachable from your machine |
| `401` error | Invalid or expired token | Generate a new long-lived token |
| Dropdown shows but is empty | HA returned empty state list | Verify HA has entities (`/api/states` in browser) |
| No request in Network tab | Credentials cached from prior success | Hard-refresh (Ctrl+Shift+R) or clear localStorage |

### Checking the raw API

You can verify your HA connection independently:

```bash
curl -s -H "Authorization: Bearer YOUR_TOKEN" \
     https://YOUR_HA_ADDRESS/api/states | head -c 500
```

This should return a JSON array of entity state objects.
