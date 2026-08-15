#!/bin/bash
set -e
cd "$(dirname "$0")"

# Requiere SHEETS_SPREADSHEET_ID (y opcionalmente GOOGLE_SERVICE_ACCOUNT_KEY_PATH)
# en el entorno -- exportarlas antes de correr este script o definirlas en el
# crontab. Ver scripts/syncSheets.js.

if ! node scripts/syncSheets.js; then
  echo "sync-and-deploy: la sincronización con Google Sheets falló, se aborta antes del build/deploy."
  exit 1
fi

./deploy.sh
