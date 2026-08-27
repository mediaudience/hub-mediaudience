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

# Cada deploy queda como una versión en GitHub. Chequeo defensivo antes de
# commitear: si algún archivo de credenciales se coló pese al .gitignore, se
# aborta el push en vez de subirlo (no rompe el deploy, que ya terminó arriba).
if [ -n "$(git status --porcelain)" ]; then
  git add -A
  if git diff --cached --name-only | grep -iqE 'secrets/|\.env$|\.sqlite$|google-service-account'; then
    echo "ADVERTENCIA: hay un archivo de credenciales en el commit -- deploy OK, pero NO se sube a git. Revisar manualmente."
    git reset
  else
    git commit -m "Deploy $(date '+%Y-%m-%d %H:%M')" >/dev/null
    git push origin master && echo "Version guardada en GitHub" || echo "ADVERTENCIA: el commit quedo local, pero el push a GitHub fallo (revisar conexion/token)"
  fi
else
  echo "Sin cambios de codigo para guardar en GitHub"
fi
