#!/bin/bash
set -e
cd "$(dirname "$0")"
npm run build
rsync -a --delete dist/ /var/www/mediaudience-panel/
chown -R www-data:www-data /var/www/mediaudience-panel
find /var/www/mediaudience-panel -type d -exec chmod 755 {} \;
find /var/www/mediaudience-panel -type f -exec chmod 644 {} \;
echo "Deployed to /var/www/mediaudience-panel"

# El build estático no incluye el backend -- si cambió código en server/,
# hay que reiniciar el proceso para que lo recoja. Sesiones activas se pierden.
systemctl restart mediaudience-backend
echo "Backend reiniciado"
