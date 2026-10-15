const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const PANEL_URL = process.env.PANEL_URL || 'https://hub.mediaudience.com/';

const ROL_LABEL = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  usuario_interno: 'Usuario Interno',
  usuario_externo: 'Usuario Externo',
};

// `nombre`/`email` los tipea un Admin al crear el usuario (texto libre, sin
// validación de formato) -- se interpolan en HTML de correo, así que hay que
// escaparlos para que no puedan romper el layout ni inyectar markup.
function escapeHtml(str) {
  return String(str ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

// Layout "Signal" (2026-10): mismos colores que el hub y la web pública.
// Fondo oscuro con bgcolor además de style, porque algunos clientes (Outlook)
// ignoran background-color en CSS. Las tipografías web no cargan en la
// mayoría de clientes de correo: se usa una pila de sistema.
const FONT = "'IBM Plex Sans', 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace";
const BG = '#06090f';
const CARD = '#0a0e17';
const SURFACE = '#121828';
const SURFACE_2 = '#1a2135';
const LINE = '#1f2638';
const TEXT = '#e9edf6';
const TEXT_2 = '#b4bbcc';
const MUTED = '#8a93a9';
const ACCENT = '#58b0ff';
const ON_ACCENT = '#040b17';
const WARN = '#d8b650';

function etiqueta(texto) {
  return `<span style="font-family: ${MONO}; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: ${MUTED};">${texto}</span>`;
}

function boton(href, texto) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
      <tr>
        <td bgcolor="${ACCENT}" style="background-color: ${ACCENT}; border-radius: 6px;">
          <a href="${href}" style="display: inline-block; padding: 14px 28px; font-family: ${MONO}; font-size: 14px; font-weight: 600; color: ${ON_ACCENT}; text-decoration: none;">${texto} &rarr;</a>
        </td>
      </tr>
    </table>`;
}

// Envoltura compartida (logo arriba, pie con el dominio) para todos los
// correos transaccionales del hub. Los estilos van en línea porque
// Gmail/Outlook/Apple Mail no respetan de forma consistente una hoja aparte.
function envoltura(contenidoHtml, seccion) {
  return `
    <div style="background-color: ${BG}; padding: 32px 16px; font-family: ${FONT};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${CARD}" style="max-width: 520px; margin: 0 auto; background-color: ${CARD}; border-radius: 8px; overflow: hidden; border: 1px solid ${LINE};">
        <tr>
          <td style="padding: 22px 32px; border-bottom: 1px solid ${LINE};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td><img src="${PANEL_URL}email-logo.png" alt="Mediaudience" width="196" height="36" style="display: block; border: 0; outline: none;" /></td>
                <td align="right">${etiqueta(seccion)}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 32px;">
            ${contenidoHtml}
          </td>
        </tr>
        <tr>
          <td style="padding: 16px 32px; border-top: 1px solid ${LINE};">
            <span style="font-family: ${MONO}; font-size: 11px; letter-spacing: 1px; color: ${MUTED};">HUB.MEDIAUDIENCE.COM &nbsp;·&nbsp; MEDIAUDIENCE LATAM</span>
          </td>
        </tr>
      </table>
    </div>
  `;
}

function titulo(texto) {
  return `<h1 style="margin: 0 0 16px; font-family: ${FONT}; font-size: 26px; line-height: 1.2; font-weight: 600; color: ${TEXT};">${texto}</h1>`;
}

function parrafo(texto, color = TEXT_2, size = 15) {
  return `<p style="margin: 0 0 20px; font-size: ${size}px; line-height: 1.6; color: ${color};">${texto}</p>`;
}

function plantillaInvitacion({ nombre, email, password, rol }) {
  return envoltura(`
    ${titulo(`Hola ${escapeHtml(nombre)}, ya tienes acceso al hub`)}
    ${parrafo(`Creamos tu cuenta con el rol <span style="font-family: ${MONO}; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: ${ACCENT}; border: 1px solid #2c5a85; border-radius: 6px; padding: 2px 7px; white-space: nowrap;">${ROL_LABEL[rol] ?? rol}</span>. Estos son tus datos de ingreso:`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${SURFACE}" style="background-color: ${SURFACE}; border: 1px solid ${LINE}; border-radius: 6px; margin: 0 0 24px;">
      <tr>
        <td style="padding: 18px 20px 8px;">
          ${etiqueta('Usuario')}
          <div style="margin-top: 4px; font-size: 15px; font-weight: 600; color: ${TEXT};">${escapeHtml(email)}</div>
        </td>
      </tr>
      <tr>
        <td style="padding: 10px 20px 18px;">
          ${etiqueta('Contraseña temporal')}
          <div style="margin-top: 8px;">
            <span style="display: inline-block; font-family: ${MONO}; font-size: 20px; font-weight: 600; letter-spacing: 2px; color: ${TEXT}; background-color: ${SURFACE_2}; border: 1px solid #2a3350; border-radius: 6px; padding: 8px 14px;">${escapeHtml(password)}</span>
          </div>
        </td>
      </tr>
    </table>
    ${boton(PANEL_URL, 'Ingresar al hub')}
    ${parrafo('Por seguridad, cambia tu contraseña apenas ingreses.', MUTED, 13)}
  `, 'Invitación');
}

function plantillaRecuperacion({ nombre, enlace }) {
  return envoltura(`
    ${titulo(`Hola ${escapeHtml(nombre)}, elige una contraseña nueva`)}
    ${parrafo('Recibimos un pedido para restablecer tu contraseña del hub. Usa el botón; el enlace vence en 30 minutos y funciona una sola vez.')}
    ${boton(enlace, 'Elegir nueva contraseña')}
    ${parrafo('Si no lo pediste tú, ignora este correo: tu contraseña actual sigue funcionando.', MUTED, 13)}
  `, 'Contraseña');
}

function plantillaCodigoAcceso({ nombre, codigo }) {
  return envoltura(`
    ${titulo(`Hola ${escapeHtml(nombre)}, usa este código para volver a entrar`)}
    ${parrafo('Tu sesión en el hub se cerró por inactividad. Escribe este código en la pantalla de ingreso:')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${SURFACE}" style="background-color: ${SURFACE}; border: 1px solid #2c5a85; border-radius: 6px; margin: 0 0 20px;">
      <tr>
        <td align="center" style="padding: 26px 20px 22px;">
          <div style="font-family: ${MONO}; font-size: 38px; font-weight: 600; letter-spacing: 12px; color: ${ACCENT};">${codigo}</div>
          <div style="margin-top: 10px; font-family: ${MONO}; font-size: 11px; letter-spacing: 1.5px; color: ${WARN};">VENCE EN 5 MINUTOS</div>
        </td>
      </tr>
    </table>
    ${parrafo('Si no lo pediste tú, ignora este correo.', MUTED, 13)}
  `, 'Código de acceso');
}

// Hace el POST a la API REST de Resend (fetch directo, sin SDK -- Node 22 ya
// trae fetch global). Si no hay API key configurada, no falla: devuelve
// enviado:false para que quien llama pueda avisar en la UI. Toda falla queda
// en el log del servidor (journalctl -u mediaudience-backend) -- antes se
// perdía en silencio porque /otp/solicitar y /olvide-password devuelven éxito
// genérico al cliente a propósito (para no filtrar qué correos existen).
async function enviarCorreo({ to, subject, html }) {
  if (!RESEND_API_KEY) {
    console.error(`[email] No se pudo enviar "${subject}" a ${to}: falta RESEND_API_KEY`);
    return { enviado: false, motivo: 'No hay un proveedor de correo configurado (RESEND_API_KEY)' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
    });

    if (!res.ok) {
      const detalle = await res.text().catch(() => '');
      console.error(`[email] Resend rechazó "${subject}" a ${to}: ${res.status} ${detalle}`);
      return { enviado: false, motivo: `El proveedor de correo respondió ${res.status}: ${detalle}` };
    }
    return { enviado: true, motivo: null };
  } catch (err) {
    console.error(`[email] No se pudo contactar a Resend para "${subject}" a ${to}: ${err.message}`);
    return { enviado: false, motivo: `No se pudo contactar al proveedor de correo: ${err.message}` };
  }
}

export async function enviarInvitacion({ nombre, email, password, rol }) {
  return enviarCorreo({
    to: email,
    subject: 'Tu acceso al Hub de Mediaudience',
    html: plantillaInvitacion({ nombre, email, password, rol }),
  });
}

export async function enviarCodigoAcceso({ nombre, email, codigo }) {
  return enviarCorreo({
    to: email,
    subject: 'Tu código para volver al Hub de Mediaudience',
    html: plantillaCodigoAcceso({ nombre, codigo }),
  });
}

export async function enviarRecuperacion({ nombre, email, token }) {
  const enlace = `${PANEL_URL}restablecer-password?token=${token}`;
  return enviarCorreo({
    to: email,
    subject: 'Restablece tu contraseña del Hub de Mediaudience',
    html: plantillaRecuperacion({ nombre, enlace }),
  });
}
