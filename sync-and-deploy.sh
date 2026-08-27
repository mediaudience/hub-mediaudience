#!/bin/bash
set -e
cd "$(dirname "$0")"

# El sheet_id de cada cliente+canal vive en cliente_canales (BD), no en el
# entorno. Lo único opcional acá es GOOGLE_SERVICE_ACCOUNT_KEY_PATH -- si no
# se define, syncSheets.js usa secrets/google-service-account.json por
# default, y si ese archivo no existe cae al CSV público como antes. Ver
# scripts/syncSheets.js.

node scripts/limpiarActividad.js || echo "sync-and-deploy: no se pudo limpiar el log de actividad, se continúa igual."

if ! node scripts/syncSheets.js; then
  echo "sync-and-deploy: la sincronización con Google Sheets falló, se aborta antes del build/deploy."
  exit 1
fi

./deploy.sh
