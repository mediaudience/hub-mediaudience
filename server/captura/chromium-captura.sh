#!/bin/sh
# Chromium para Admin > Preview Testigos (server/previewTestigosCaptura.js).
# El backend corre como root; Chromium baja a `nobody` antes de abrir el medio
# (páginas con anuncios de terceros) y así también puede usar su sandbox.
export HOME="${HOME:-/tmp}"
exec /usr/bin/setpriv --reuid=65534 --regid=65534 --clear-groups /usr/bin/chromium "$@"
