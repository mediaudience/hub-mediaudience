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
  // Mismo layout "Signal" que los correos de server/email.js, pero con
  // borde rojo: es una alerta, no un correo transaccional.
  const ahora = new Date().toLocaleString("es-PE", { timeZone: "America/Lima", dateStyle: "medium", timeStyle: "short" });
  const mono = "'JetBrains Mono','SFMono-Regular',Consolas,monospace";
  const html = `<div style="background-color:#06090f;padding:32px 16px;font-family:'IBM Plex Sans','Segoe UI',Helvetica,Arial,sans-serif">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#0a0e17" style="max-width:520px;margin:0 auto;background-color:#0a0e17;border:1px solid #5a2a2a;border-radius:8px">
      <tr><td style="padding:20px 28px;border-bottom:1px solid #1f2638">
        <span style="font-family:${mono};font-size:11px;letter-spacing:1.5px;color:#e4665b;border:1px solid #6b3330;border-radius:6px;padding:4px 8px">&#9679; ALERTA</span>
        <span style="font-family:${mono};font-size:11px;letter-spacing:1.5px;color:#8a93a9;margin-left:10px">HUB-MEDIAUDIENCE</span>
      </td></tr>
      <tr><td style="padding:24px 28px">
        <h1 style="margin:0 0 8px;font-size:22px;line-height:1.25;font-weight:600;color:#e9edf6">${asunto}</h1>
        <p style="margin:0 0 18px;font-family:${mono};font-size:12px;color:#8a93a9">${ahora} (hora de Lima)</p>
        <pre style="margin:0 0 18px;white-space:pre-wrap;background-color:#06090f;border:1px solid #1f2638;border-radius:6px;padding:14px 16px;font-family:${mono};font-size:12.5px;line-height:1.6;color:#b4bbcc">${detalleEscapado}</pre>
        <a href="https://hub.mediaudience.com/" style="font-family:${mono};font-size:13px;color:#58b0ff;text-decoration:none">Abrir el hub &rarr;</a>
      </td></tr>
      <tr><td style="padding:14px 28px;border-top:1px solid #1f2638;font-family:${mono};font-size:11px;letter-spacing:1px;color:#8a93a9">MONITOREO AUTOMÁTICO CADA 5 MIN</td></tr>
    </table>
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

// Avisa si el disco raíz pasa del umbral. Para no mandar un correo cada 5 min,
// repite la alerta como máximo una vez por día mientras siga arriba.
const UMBRAL_DISCO = 80;
function chequearDisco() {
  try {
    const salida = execSync("df -P /", { encoding: "utf8" }).trim().split("\n").pop();
    const [, , usado, libre, porcentaje] = salida.split(/\s+/);
    return { pct: parseInt(porcentaje, 10), usadoGB: (usado / 1048576).toFixed(1), libreGB: (libre / 1048576).toFixed(1) };
  } catch {
    return null;
  }
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

  const disco = chequearDisco();
  let ultimaAlertaDiscoISO = estado.ultimaAlertaDiscoISO || null;
  if (disco && disco.pct >= UMBRAL_DISCO) {
    const haceUnDia = Date.now() - 24 * 60 * 60 * 1000;
    if (!ultimaAlertaDiscoISO || new Date(ultimaAlertaDiscoISO).getTime() < haceUnDia) {
      await enviarAlerta(
        env,
        `Disco al ${disco.pct}%`,
        `El disco del servidor está al ${disco.pct}% (usado ${disco.usadoGB} GB, libre ${disco.libreGB} GB).\nUmbral de aviso: ${UMBRAL_DISCO}%.`
      );
      ultimaAlertaDiscoISO = ahoraISO;
    }
  } else {
    ultimaAlertaDiscoISO = null;
  }

  guardarEstado({ ultimaRevisionISO: ahoraISO, ultimaAlertaDiscoISO });
  console.log(
    `[monitor] ${ahoraISO} -- HTTP: ${problemasHTTP.length === 0 ? "OK" : problemasHTTP.length + " problema(s)"}, logs: ${lineasError.length} error(es) nuevo(s), disco: ${disco ? disco.pct + "%" : "?"}`
  );
}

main();
