ARG BUILD_FROM
ARG BUILD_ARCH
ARG BUILD_VERSION

# Stage 1: Build Vue 3 frontend
# Context is ha-sweethome3d/ root, so www-vue/ and sweethome3d/ are both accessible
FROM node:20-alpine AS vue-builder
WORKDIR /build
COPY www-vue/package*.json ./
RUN npm install
COPY www-vue/ ./
RUN npm run build

# Stage 2: Runtime image
FROM ${BUILD_FROM}

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
    rm -rf /var/cache/apk/* && \
    # Disable auto-start services to prevent conflicts with s6
    rc-update del nginx default || true && \
    rc-update del php-fpm82 default || true

# Copy nginx configuration
COPY sweethome3d/rootfs/etc/nginx/ /etc/nginx/

# Copy PHP-FPM configuration
COPY sweethome3d/rootfs/etc/php82/ /etc/php82/

# Copy SweetHome3D lib files (lib/, resources/, CSS, etc.)
COPY sweethome3d/www/ /var/www/html/

# Overlay Vue build on top: replaces index.html and adds assets/
COPY --from=vue-builder /build/dist/ /var/www/html/

# Copy Unity WebGL build (pre-built, placed at ha-sweethome3d/unity-build/)
COPY unity-build/ /var/www/html/unity-visualizer/

# Copy startup script
COPY sweethome3d/start.sh /start.sh

# Copy startup script and services (for Home Assistant compatibility)
COPY sweethome3d/rootfs/etc/cont-init.d/ /etc/cont-init.d/
COPY sweethome3d/rootfs/etc/services.d/ /etc/services.d/

# Set permissions
RUN chmod a+x /etc/cont-init.d/* && \
    chmod a+x /etc/services.d/*/run && \
    chmod a+x /etc/services.d/*/finish && \
    chmod +x /start.sh && \
    mkdir -p /var/www/html/data && \
    chown -R nginx:nginx /var/www/html && \
    chmod 755 /var/www/html && \
    chmod 777 /var/www/html/data && \
    # Ensure run directory exists and has correct permissions
    mkdir -p /var/run && \
    chown nginx:nginx /var/run

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

# When running locally (like with docker-compose), use start.sh
# When running as HA addon, the BUILD_FROM will have s6-overlay and this CMD will be overridden
CMD ["/start.sh"]
