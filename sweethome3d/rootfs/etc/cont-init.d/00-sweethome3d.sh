#!/usr/bin/with-contenv bashio

bashio::log.info "Starting SweetHome3D addon..."

# Clean up any existing sockets and pid files
rm -f /var/run/php82-fpm.sock
rm -f /var/run/php82-fpm.pid
rm -f /var/run/nginx.pid

# Get addon options
PHP_MAX_EXECUTION_TIME=$(bashio::config 'php_max_execution_time')
PHP_MEMORY_LIMIT=$(bashio::config 'php_memory_limit')
PHP_UPLOAD_MAX_FILESIZE=$(bashio::config 'php_upload_max_filesize')
PHP_POST_MAX_SIZE=$(bashio::config 'php_post_max_size')

# Update PHP configuration with user options
if bashio::config.has_value 'php_max_execution_time'; then
    sed -i "s/php_admin_value\[max_execution_time\] = .*/php_admin_value[max_execution_time] = ${PHP_MAX_EXECUTION_TIME}/" /etc/php82/php-fpm.conf
fi

if bashio::config.has_value 'php_memory_limit'; then
    sed -i "s/php_admin_value\[memory_limit\] = .*/php_admin_value[memory_limit] = ${PHP_MEMORY_LIMIT}/" /etc/php82/php-fpm.conf
fi

if bashio::config.has_value 'php_upload_max_filesize'; then
    sed -i "s/php_admin_value\[upload_max_filesize\] = .*/php_admin_value[upload_max_filesize] = ${PHP_UPLOAD_MAX_FILESIZE}/" /etc/php82/php-fpm.conf
fi

if bashio::config.has_value 'php_post_max_size'; then
    sed -i "s/php_admin_value\[post_max_size\] = .*/php_admin_value[post_max_size] = ${PHP_POST_MAX_SIZE}/" /etc/php82/php-fpm.conf
fi

# Ensure persistent home storage exists with correct permissions
chown -R nginx:nginx /var/www/html
chmod 755 /var/www/html
mkdir -p /data/homes
chown nginx:nginx /data/homes
chmod 755 /data/homes

# Create log directories
mkdir -p /var/log/nginx
mkdir -p /var/log/php

# ── Generate HA configuration JSON for the frontend & Unity visualizer ──
HA_CONFIG_FILE="/var/www/html/ha-config.json"

HA_ADDRESS=""
HA_TOKEN=""
HA_USE_SSL="true"

if bashio::config.has_value 'homeassistant_address'; then
    HA_ADDRESS=$(bashio::config 'homeassistant_address')
fi

if bashio::config.has_value 'homeassistant_token'; then
    HA_TOKEN=$(bashio::config 'homeassistant_token')
fi

if bashio::config.has_value 'use_ssl'; then
    HA_USE_SSL=$(bashio::config 'use_ssl')
fi

# Auto-detect HA address via Supervisor API if not configured
if [ -z "${HA_ADDRESS}" ] && [ -n "${SUPERVISOR_TOKEN:-}" ]; then
    bashio::log.info "No HA address configured, attempting auto-detection via Supervisor API..."
    HA_CORE_CONFIG=$(curl -sSf \
        -H "Authorization: Bearer ${SUPERVISOR_TOKEN}" \
        http://supervisor/core/api/config 2>/dev/null || true)

    if [ -n "${HA_CORE_CONFIG}" ]; then
        # Try external_url first, then internal_url
        DETECTED_URL=$(echo "${HA_CORE_CONFIG}" | python3 -c "
import sys, json
try:
    c = json.load(sys.stdin)
    url = c.get('external_url') or c.get('internal_url') or ''
    # Strip protocol prefix — connector builds ws(s)://address/api/websocket
    url = url.replace('https://', '').replace('http://', '').rstrip('/')
    print(url)
except:
    pass
" 2>/dev/null || true)

        if [ -n "${DETECTED_URL}" ]; then
            HA_ADDRESS="${DETECTED_URL}"
            bashio::log.info "Auto-detected HA address: ${HA_ADDRESS}"
        fi
    fi
fi

# Escape token for safe JSON embedding (handle special chars)
HA_TOKEN_ESCAPED=$(python3 -c "
import sys, json
print(json.dumps(sys.argv[1])[1:-1])
" "${HA_TOKEN}" 2>/dev/null || echo "${HA_TOKEN}")

cat > "${HA_CONFIG_FILE}" <<EOJSON
{
  "homeAssistantAddress": "${HA_ADDRESS}",
  "homeAssistantAccessToken": "${HA_TOKEN_ESCAPED}",
  "useSSL": ${HA_USE_SSL},
    "trackedEntities": [],
  "source": "addon-options"
}
EOJSON

chown nginx:nginx "${HA_CONFIG_FILE}"
chmod 644 "${HA_CONFIG_FILE}"

if [ -n "${HA_ADDRESS}" ]; then
    bashio::log.info "HA config written (address: ${HA_ADDRESS}, token length: ${#HA_TOKEN})"
else
    bashio::log.warning "HA address not configured — set in Add-on Configuration or it will be auto-detected from the browser"
fi

bashio::log.info "SweetHome3D addon initialization complete"
