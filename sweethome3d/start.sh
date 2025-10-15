#!/bin/sh

# Simple startup script for local testing
# This replaces s6-overlay for basic functionality
# Optimized for ARM/Raspberry Pi systems

echo "Starting SweetHome3D addon for local testing..."
echo "Architecture: $(uname -m)"

# Create necessary directories
mkdir -p /var/log/nginx
mkdir -p /var/log/php
mkdir -p /var/www/html/data

# Set permissions
chown -R nginx:nginx /var/www/html
chmod 755 /var/www/html
chmod 777 /var/www/html/data

# Update PHP configuration with default values
sed -i "s/php_admin_value\[max_execution_time\] = .*/php_admin_value[max_execution_time] = 300/" /etc/php82/php-fpm.conf
sed -i "s/php_admin_value\[memory_limit\] = .*/php_admin_value[memory_limit] = 256M/" /etc/php82/php-fpm.conf
sed -i "s/php_admin_value\[upload_max_filesize\] = .*/php_admin_value[upload_max_filesize] = 50M/" /etc/php82/php-fpm.conf
sed -i "s/php_admin_value\[post_max_size\] = .*/php_admin_value[post_max_size] = 50M/" /etc/php82/php-fpm.conf

echo "Starting PHP-FPM..."
php-fpm82 --daemonize --fpm-config /etc/php82/php-fpm.conf

echo "Starting Nginx..."
nginx -g "daemon off;" &

# Keep the container running
wait
