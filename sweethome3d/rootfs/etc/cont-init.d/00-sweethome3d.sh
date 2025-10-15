#!/usr/bin/with-contenv bashio

bashio::log.info "Starting SweetHome3D addon..."

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

# Ensure data directory exists with correct permissions
mkdir -p /var/www/html/data
chown -R nginx:nginx /var/www/html
chmod 755 /var/www/html
chmod 777 /var/www/html/data

# Create log directories
mkdir -p /var/log/nginx
mkdir -p /var/log/php

bashio::log.info "SweetHome3D addon initialization complete"
