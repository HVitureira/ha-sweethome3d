ARG BUILD_FROM=ghcr.io/home-assistant/aarch64-base:3.20
ARG BUILD_ARCH
ARG BUILD_VERSION

FROM $BUILD_FROM

# Set shell
SHELL ["/bin/sh", "-o", "pipefail", "-c"]

# Install required packages (optimized for ARM/Pi)
RUN apk add --no-cache \
    nginx \
    php82 \
    php82-fpm \
    php82-json \
    php82-session \
    php82-zip \
    php82-mbstring \
    php82-fileinfo \
    php82-openssl \
    curl \
    bash && \
    # Optimize for ARM architectures
    rm -rf /var/cache/apk/*

# Copy nginx configuration
COPY rootfs/etc/nginx/ /etc/nginx/

# Copy PHP-FPM configuration
COPY rootfs/etc/php82/ /etc/php82/

# Copy SweetHome3D files
COPY www/ /var/www/html/

# Copy startup script
COPY start.sh /start.sh

# Copy startup script and services (for Home Assistant compatibility)
COPY rootfs/etc/cont-init.d/ /etc/cont-init.d/
COPY rootfs/etc/services.d/ /etc/services.d/

# Set permissions
RUN chmod a+x /etc/cont-init.d/* && \
    chmod a+x /etc/services.d/*/run && \
    chmod a+x /etc/services.d/*/finish && \
    chmod +x /start.sh && \
    mkdir -p /var/www/html/data && \
    chown -R nginx:nginx /var/www/html && \
    chmod 755 /var/www/html && \
    chmod 777 /var/www/html/data

# Labels
LABEL \
    io.hass.name="SweetHome3D" \
    io.hass.description="SweetHome3D JS - Interior design application for Home Assistant" \
    io.hass.arch="${BUILD_ARCH:-aarch64}" \
    io.hass.type="addon" \
    io.hass.version="${BUILD_VERSION:-1.0.0}" \
    maintainer="Your Name <your-email@example.com>" \
    org.opencontainers.image.title="SweetHome3D Home Assistant Add-on" \
    org.opencontainers.image.description="SweetHome3D JS - Interior design application for Home Assistant" \
    org.opencontainers.image.source="https://github.com/HVitureira/ha-sweethome3d" \
    org.opencontainers.image.licenses="GPL-2.0"

EXPOSE 8099

# Use simple startup script for local testing
CMD ["/start.sh"]