import puppeteer from 'puppeteer-core';
import path from 'node:path';
import dns from 'node:dns/promises';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { mkdtemp, rm, chown, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { FORMATOS_TESTIGO, VIEWPORT_TESTIGO } from '../shared/previewTestigos.js';

// Captura del medio para Admin > Preview Testigos: abre la URL como desktop y
// como celular, oculta popups (cookies, notificaciones push, modales) y
// devuelve la página completa en JPG + los espacios de publicidad que calzan
// con los formatos IAB.
//
// Chromium NO corre como root: el wrapper chromium-captura.sh baja a
// `nobody` antes de ejecutarlo (así puede usar su propio sandbox). Las
// páginas de medios cargan anuncios de terceros; no queremos ese código con
// permisos de root en el server del hub.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WRAPPER = path.join(__dirname, 'captura', 'chromium-captura.sh');
const ALTO_MAXIMO = 6000; // px CSS; más que eso es una página infinita
const UID_NOBODY = 65534;

const UA_MOBILE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

// --- Bloqueo de direcciones internas (SSRF) ---------------------------------

function ipPrivada(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
    );
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return ipPrivada(v.slice(7));
  return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80');
}

function hostProhibido(host) {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.local')) return true;
  return net.isIP(h) ? ipPrivada(h) : false;
}

// Valida la URL antes de abrirla: http(s), sin usuario/clave y con un host
// público (también resuelto por DNS).
export async function validarUrlMedio(texto) {
  let u;
  try {
    u = new URL(String(texto || '').trim());
  } catch {
    throw new Error('La URL no es válida. Tiene que empezar con https://');
  }
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('La URL tiene que empezar con https://');
  if (u.username || u.password) throw new Error('La URL no puede llevar usuario ni clave');
  if (hostProhibido(u.hostname)) throw new Error('Esa dirección no es un medio público');
  let ips;
  try {
    ips = await dns.lookup(u.hostname, { all: true });
  } catch {
    throw new Error(`No se encontró el sitio ${u.hostname}. Revisa la URL.`);
  }
  if (!ips.length || ips.some((r) => ipPrivada(r.address))) throw new Error('Esa dirección no es un medio público');
  return u.toString();
}

// Avisos de proveedores conocidos (OneSignal, Didomi, Quantcast, OneTrust,
// Cookiebot, Funding Choices, Piano) que se ocultan aunque no estén "fijos".
const CSS_POPUPS = `
  #onesignal-slidedown-container, #onesignal-popover-container, #onesignal-bell-container, .onesignal-slidedown-container,
  #didomi-host, #qc-cmp2-container, #onetrust-consent-sdk, #CybotCookiebotDialog, .fc-consent-root, .fc-dialog-overlay,
  .tp-modal, .tp-backdrop, [id^="sp_message_container"] { display: none !important; }`;

// --- Dentro de la página -----------------------------------------------------

function ocultarPopups() {
  const RX =
    /(onesignal|cookie|consent|gdpr|didomi|qc-cmp|truste|osano|sp_message|fc-consent|cmp-|modal|popup|pop-up|newsletter|notific|push|interstitial|subscri|suscri|paywall|lightbox|backdrop|overlay|prompt|gr-visual)/i;
  const area = innerWidth * innerHeight;
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    const r = el.getBoundingClientRect();
    const firma = `${el.id} ${String(el.className)} ${el.getAttribute('role') || ''}`;
    const grande = r.width * r.height > area * 0.25;
    const z = parseInt(cs.zIndex, 10) || 0;
    if (RX.test(firma) || el.getAttribute('role') === 'dialog' || el.getAttribute('aria-modal') === 'true' || (grande && z >= 100) || z >= 100000) {
      el.style.setProperty('display', 'none', 'important');
    }
  }
  for (const el of [document.documentElement, document.body]) {
    el.style.setProperty('overflow', 'visible', 'important');
  }
}

function detectarEspacios(formatos) {
  const fijo = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const p = getComputedStyle(n).position;
      if (p === 'fixed' || p === 'sticky') return true;
    }
    return false;
  };
  const vistos = new Set();
  const out = [];
  const ancho = innerWidth;
  for (const el of document.querySelectorAll('iframe,div,ins,img,a,aside,section,span')) {
    const r = el.getBoundingClientRect();
    if (r.width < 100 || r.height < 40) continue;
    const f = formatos.find((x) => Math.abs(r.width - x.ancho) <= 2 && Math.abs(r.height - x.alto) <= 2);
    if (!f) continue;
    const x = Math.round(r.left + scrollX);
    const y = Math.round(r.top + scrollY);
    if (x < 0 || x + f.ancho > ancho + 2 || y < 0) continue;
    const clave = `${f.ancho}x${f.alto}@${Math.round(x / 4)},${Math.round(y / 4)}`;
    if (vistos.has(clave) || fijo(el)) continue;
    vistos.add(clave);
    out.push({ w: f.ancho, h: f.alto, x, y });
  }
  return out;
}

async function capturarDispositivo(browser, url, dev, destino) {
  const vp = VIEWPORT_TESTIGO[dev];
  const page = await browser.newPage();
  try {
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      try {
        const u = new URL(req.url());
        if (['http:', 'https:'].includes(u.protocol) && hostProhibido(u.hostname)) return req.abort('blockedbyclient');
      } catch {
        // data:, blob:, etc.
      }
      req.continue();
    });
    if (dev === 'mobile') await page.setUserAgent(UA_MOBILE);
    await page.setViewport({
      width: vp.ancho,
      height: vp.alto,
      deviceScaleFactor: vp.escala,
      isMobile: dev === 'mobile',
      hasTouch: dev === 'mobile',
    });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 35000 }).catch((err) => {
      // Muchos medios nunca quedan "quietos" (video, sockets): si ya cargó
      // el documento, se sigue igual.
      if (!/timeout/i.test(err.message)) throw err;
    });
    // Recorre la página para que carguen las imágenes y los anuncios lazy.
    await page.evaluate(async (max) => {
      const alto = Math.min(document.documentElement.scrollHeight, max);
      for (let y = 0; y < alto; y += 500) {
        scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 220));
      }
      scrollTo(0, 0);
    }, ALTO_MAXIMO);
    await new Promise((r) => setTimeout(r, 2500));
    await page.addStyleTag({ content: CSS_POPUPS }).catch(() => {});
    await page.evaluate(ocultarPopups);
    const espacios = await page.evaluate(detectarEspacios, FORMATOS_TESTIGO);
    const alto = await page.evaluate(
      (max) => Math.min(Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, innerHeight), max),
      ALTO_MAXIMO
    );
    // Algunos avisos (notificaciones push, cookies) aparecen tarde: segunda pasada.
    await new Promise((r) => setTimeout(r, 800));
    await page.evaluate(ocultarPopups);
    const titulo = await page.title().catch(() => '');
    const buf = await page.screenshot({
      type: 'jpeg',
      quality: 85,
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: vp.ancho, height: alto },
    });
    await writeFile(destino, buf);
    return {
      meta: {
        ancho: vp.ancho,
        alto,
        escala: vp.escala,
        espacios: espacios.filter((e) => e.y + e.h <= alto).map((e, i) => ({ id: `${dev[0]}${i + 1}`, ...e, origen: 'detectado' })),
      },
      titulo,
    };
  } finally {
    await page.close().catch(() => {});
  }
}

export async function capturarMedio(url, dir) {
  const perfil = await mkdtemp(path.join(os.tmpdir(), 'testigo-chrome-'));
  await chown(perfil, UID_NOBODY, UID_NOBODY);
  const browser = await puppeteer.launch({
    executablePath: WRAPPER,
    headless: true,
    userDataDir: perfil,
    protocolTimeout: 90000,
    args: ['--disable-dev-shm-usage', '--hide-scrollbars', '--mute-audio', '--deny-permission-prompts', '--no-first-run', '--lang=es-419'],
    env: { HOME: perfil, PATH: '/usr/bin:/bin' },
  });
  try {
    const d = await capturarDispositivo(browser, url, 'desktop', path.join(dir, 'desktop.jpg'));
    const m = await capturarDispositivo(browser, url, 'mobile', path.join(dir, 'mobile.jpg'));
    return { desktop: d.meta, mobile: m.meta, titulo: (d.titulo || m.titulo || '').slice(0, 200) };
  } finally {
    await browser.close().catch(() => {});
    await rm(perfil, { recursive: true, force: true }).catch(() => {});
  }
}
