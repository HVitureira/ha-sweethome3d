#!/bin/sh

# Simple startup script for local testing ONLY
# This should NOT be used when running as a Home Assistant addon
# Home Assistant addons use s6-overlay service management

echo "Starting SweetHome3D addon for local testing..."
echo "Architecture: $(uname -m)"

# Check if we're running under s6 (Home Assistant addon mode)
if [ -d "/etc/s6-overlay" ] || [ -n "$S6_STAGE2_HOOK" ]; then
    echo "Detected s6-overlay environment. Services will be managed by s6."
    echo "Waiting for services to start..."
    # Just wait - s6 will handle service startup
    sleep infinity
    exit 0
fi

echo "Running in standalone mode - starting services manually..."

# Create necessary directories
mkdir -p /var/log/nginx
mkdir -p /var/log/php
mkdir -p /var/www/html/data

# Generate ha-config.json from OPTIONS_JSON for frontend/Unity config
# (In HA addon mode, 00-sweethome3d.sh handles this via bashio)
OPTIONS_FILE="${OPTIONS_JSON:-/data/options.json}"
HA_CONFIG="/var/www/html/ha-config.json"
if [ -f "$OPTIONS_FILE" ]; then
    # Use PHP (already installed) to transform options.json → ha-config.json
    php82 -r '
        $opts = json_decode(file_get_contents($argv[1]), true) ?: [];
        $cfg = [
            "homeAssistantAddress" => $opts["homeassistant_address"] ?? "",
            "homeAssistantAccessToken" => $opts["homeassistant_token"] ?? "",
            "useSSL" => $opts["use_ssl"] ?? true,
            "trackedEntities" => [],
            "source" => "addon-options"
        ];
        file_put_contents($argv[2], json_encode($cfg, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    ' "$OPTIONS_FILE" "$HA_CONFIG"
    echo "Generated ha-config.json from $OPTIONS_FILE"
else
    echo '{"source":"standalone"}' > "$HA_CONFIG"
    echo "No OPTIONS_JSON found, created empty ha-config.json"
fi

# Set permissions
chown -R nginx:nginx /var/www/html
chmod 755 /var/www/html
chmod 777 /var/www/html/data

# Stop any existing services first
echo "Stopping any existing services..."
pkill -f php-fpm82 || true
pkill -f nginx || true
sleep 2

# Update PHP configuration with default values
sed -i "s/php_admin_value\[max_execution_time\] = .*/php_admin_value[max_execution_time] = 300/" /etc/php82/php-fpm.conf
sed -i "s/php_admin_value\[memory_limit\] = .*/php_admin_value[memory_limit] = 256M/" /etc/php82/php-fpm.conf
sed -i "s/php_admin_value\[upload_max_filesize\] = .*/php_admin_value[upload_max_filesize] = 200M/" /etc/php82/php-fpm.conf
sed -i "s/php_admin_value\[post_max_size\] = .*/php_admin_value[post_max_size] = 200M/" /etc/php82/php-fpm.conf

echo "Starting PHP-FPM..."
php-fpm82 --daemonize --fpm-config /etc/php82/php-fpm.conf

echo "Starting Nginx..."
nginx -g "daemon off;" &

# Keep the container running
wait
