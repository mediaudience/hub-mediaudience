import { Router } from 'express';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { dibujarFirma } from '../shared/firmaPng.js';
import db from './db.js';

// Imagen pública de cada firma registrada, para pegarla en Gmail con
// "Insertar imagen > Dirección web (URL)". Sin login a propósito: Gmail (y
// quien reciba el correo) la pide sin sesión. El token es aleatorio por
// firma, así que no se puede recorrer el registro adivinando ids.
//
// La URL no cambia al editar la firma: la imagen se regenera sola y los
// correos la muestran actualizada (con el caché de Gmail de por medio).

const FONTS_DIR = process.env.FIRMA_FONTS_DIR || '/usr/local/share/fonts/mediaudience';
try {
  for (const f of readdirSync(FONTS_DIR)) {
    if (/\.(ttf|otf)$/i.test(f)) GlobalFonts.registerFromPath(`${FONTS_DIR}/${f}`);
  }
} catch (err) {
  console.error(`[firma-imagen] no se pudieron cargar las fuentes de ${FONTS_DIR}: ${err.message}`);
}

const LOGOS_DIR = fileURLToPath(new URL('../public/firma/', import.meta.url));
const logos = {};
async function logosDe(tema) {
  logos[tema] ??= Promise.all([
    loadImage(`${LOGOS_DIR}isotipo-${tema}.png`),
    loadImage(`${LOGOS_DIR}wordmark-${tema}.png`),
  ]);
  return logos[tema];
}

// PNG ya dibujado por firma y tema; la clave lleva updated_at, así una
// edición invalida la versión vieja sin pasos extra.
const cache = new Map();

const router = Router();

router.get('/:token/:version.png', async (req, res, next) => {
  try {
    const tema = { oscura: 'oscuro', clara: 'claro' }[req.params.version];
    const firma = tema && db.prepare('SELECT * FROM firmas WHERE token = ?').get(req.params.token);
    if (!firma) return res.status(404).end();

    const clave = `${firma.token}:${tema}:${firma.updated_at}`;
    let png = cache.get(clave);
    if (!png) {
      const [isotipo, wordmark] = await logosDe(tema);
      const canvas = dibujarFirma({ datos: firma, tema, crearCanvas: createCanvas, isotipo, wordmark });
      png = await canvas.encode('png');
      for (const k of cache.keys()) if (k.startsWith(`${firma.token}:${tema}:`)) cache.delete(k);
      cache.set(clave, png);
    }
    res.set('Cache-Control', 'public, max-age=3600');
    res.type('png').send(png);
  } catch (err) {
    next(err);
  }
});

export default router;
