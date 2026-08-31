#!/usr/bin/env node
// Chequeo periódico de salud de hub.mediaudience.com -- corre por cron cada
// 5 min de forma independiente del panel y de cualquier sesión de Claude (si
// el backend está caído, este script igual puede avisar por correo). Guarda
// su propio estado en health-monitor-state.json para no reprocesar los
// mismos logs en cada corrida.
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, "../server/.env");
const STATE_PATH = path.join(__dirname, "health-monitor-state.json");
const SITE_URL = "https://hub.mediaudience.com";
const ALERT_TO = "jose@adops.pe";

function cargarEnv() {
  const contenido = fs.readFileSync(ENV_PATH, "utf8");
  const env = {};
  for (const linea of contenido.split("\n")) {
    const m = linea.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

function cargarEstado() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
  } catch {
    return { ultimaRevisionISO: null };
  }
}

function guardarEstado(estado) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(estado, null, 2));
}

async function enviarAlerta(env, asunto, detalle) {
  if (!env.RESEND_API_KEY) {
    console.error("[monitor] Sin RESEND_API_KEY, no se pudo alertar:", asunto);
    return;
  }
  const detalleEscapado = detalle
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const html = `<div style="font-family:sans-serif;font-size:14px;color:#1f2937">
    <p><strong>${asunto}</strong></p>
    <pre style="white-space:pre-wrap;background:#f3f3f3;padding:12px;border-radius:8px;font-size:12px">${detalleEscapado}</pre>
    <p style="color:#768b9e;font-size:12px">Monitoreo automático de hub.mediaudience.com</p>
  </div>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.EMAIL_FROM || "onboarding@resend.dev",
        to: ALERT_TO,
        subject: `[hub-mediaudience] ${asunto}`,
        html,
      }),
    });
    if (!res.ok) console.error("[monitor] Resend rechazó la alerta:", res.status, await res.text().catch(() => ""));
  } catch (err) {
    console.error("[monitor] No se pudo enviar la alerta por correo:", err.message);
  }
}

async function chequearHTTP() {
  const problemas = [];
  try {
    const r = await fetch(`${SITE_URL}/api/health`, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) problemas.push(`/api/health respondió ${r.status}`);
  } catch (err) {
    problemas.push(`/api/health no respondió: ${err.message}`);
  }
  try {
    const r = await fetch(SITE_URL, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) problemas.push(`/ respondió ${r.status}`);
  } catch (err) {
    problemas.push(`/ no respondió: ${err.message}`);
  }
  return problemas;
}

function chequearLogsDesde(desdeISO) {
  const desde = desdeISO ? new Date(desdeISO) : new Date(Date.now() - 10 * 60 * 1000);
  let salida = "";
  try {
    salida = execSync(`journalctl -u mediaudience-backend --since "${desde.toISOString()}" --no-pager -o cat`, {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (err) {
    return [`No se pudo leer journalctl: ${err.message}`];
  }
  return salida
    .split("\n")
    .filter((l) => /\[client-error\]|UnhandledPromiseRejection|TypeError|ReferenceError|Error interno del servidor/.test(l));
}

async function main() {
  const env = cargarEnv();
  const estado = cargarEstado();
  const ahoraISO = new Date().toISOString();

  const problemasHTTP = await chequearHTTP();
  const lineasError = chequearLogsDesde(estado.ultimaRevisionISO);

  if (problemasHTTP.length > 0) {
    await enviarAlerta(env, "El sitio no responde correctamente", problemasHTTP.join("\n"));
  }
  if (lineasError.length > 0) {
    await enviarAlerta(env, `${lineasError.length} error(es) nuevo(s) en el backend`, lineasError.slice(0, 30).join("\n"));
  }

  guardarEstado({ ultimaRevisionISO: ahoraISO });
  console.log(
    `[monitor] ${ahoraISO} -- HTTP: ${problemasHTTP.length === 0 ? "OK" : problemasHTTP.length + " problema(s)"}, logs: ${lineasError.length} error(es) nuevo(s)`
  );
}

main();
