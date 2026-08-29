const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';
// Temporal: mientras no haya dominio propio para el login, el botón del correo
// apunta a la IP del servidor. Cambiar el día que el panel tenga su URL final.
const PANEL_URL = process.env.PANEL_URL || 'http://169.58.118.177/';

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

const FONT = "'Poppins', Helvetica, Arial, sans-serif";
const PURPLE = '#57007e';
const MAGENTA = '#c4216f';
const SLATE = '#768b9e';
const INK = '#1f2937';

// Envoltura compartida (header con logo + footer) para todos los correos
// transaccionales del panel. Los estilos van en línea porque Gmail/Outlook/
// Apple Mail no respetan de forma consistente una hoja de estilos aparte.
function envoltura(contenidoHtml) {
  return `
    <div style="background-color: #f3f3f3; padding: 32px 16px; font-family: ${FONT};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #eaeaea;">
        <tr>
          <td style="background-color: ${PURPLE}; background-image: linear-gradient(135deg, ${PURPLE}, ${MAGENTA}); padding: 24px 32px;">
            <img src="http://169.58.118.177/assets/mediaudience-logo-blanco-D_i5C9Ua.png" alt="Mediaudience" width="160" height="33" style="display: block; border: 0; outline: none;" />
          </td>
        </tr>
        <tr>
          <td style="padding: 32px;">
            ${contenidoHtml}
          </td>
        </tr>
        <tr>
          <td style="padding: 16px 32px; border-top: 1px solid #eaeaea;">
            <span style="color: ${SLATE}; font-size: 12px;">Mediaudience Latam</span>
          </td>
        </tr>
      </table>
    </div>
  `;
}

function plantillaInvitacion({ nombre, email, password, rol }) {
  return envoltura(`
    <p style="margin: 0 0 4px; color: ${INK}; font-size: 15px;">Hola ${escapeHtml(nombre)},</p>
    <p style="margin: 0 0 20px; color: ${INK}; font-size: 15px; line-height: 1.5;">
      Se creó tu acceso al panel con el rol
      <span style="display: inline-block; background-color: #f3e8fb; color: ${PURPLE}; font-size: 12px; font-weight: 600; letter-spacing: 0.3px; text-transform: uppercase; padding: 3px 10px; border-radius: 999px;">${ROL_LABEL[rol] ?? rol}</span>.
      Estos son tus datos de ingreso:
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7f5fa; border-left: 4px solid ${PURPLE}; border-radius: 8px; margin: 0 0 20px;">
      <tr>
        <td style="padding: 14px 18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding: 4px 12px 4px 0; color: ${SLATE}; font-size: 13px; white-space: nowrap;">Usuario</td>
              <td style="padding: 4px 0; color: ${INK}; font-size: 14px; font-weight: 600;">${escapeHtml(email)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 12px 4px 0; color: ${SLATE}; font-size: 13px; white-space: nowrap;">Contraseña</td>
              <td style="padding: 4px 0; color: ${INK}; font-size: 14px; font-weight: 600;">${password}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 20px;">
      <tr>
        <td align="center">
          <a href="${PANEL_URL}" style="display: inline-block; background-color: ${PURPLE}; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 11px 28px; border-radius: 999px;">Ingresar al panel</a>
        </td>
      </tr>
    </table>
    <p style="margin: 0; color: ${SLATE}; font-size: 13px; line-height: 1.5;">Por seguridad, te recomendamos cambiar tu contraseña apenas ingreses.</p>
  `);
}

function plantillaRecuperacion({ nombre, enlace }) {
  return envoltura(`
    <p style="margin: 0 0 4px; color: ${INK}; font-size: 15px;">Hola ${escapeHtml(nombre)},</p>
    <p style="margin: 0 0 20px; color: ${INK}; font-size: 15px; line-height: 1.5;">
      Pediste restablecer tu contraseña del panel. Tocá el botón para elegir una nueva -- el enlace vence en 30 minutos y solo funciona una vez.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 20px;">
      <tr>
        <td align="center">
          <a href="${enlace}" style="display: inline-block; background-color: ${PURPLE}; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 11px 28px; border-radius: 999px;">Elegir nueva contraseña</a>
        </td>
      </tr>
    </table>
    <p style="margin: 0; color: ${SLATE}; font-size: 13px; line-height: 1.5;">Si no fuiste vos quien lo pidió, ignora este correo -- tu contraseña actual sigue funcionando.</p>
  `);
}

function plantillaCodigoAcceso({ nombre, codigo }) {
  return envoltura(`
    <p style="margin: 0 0 4px; color: ${INK}; font-size: 15px;">Hola ${escapeHtml(nombre)},</p>
    <p style="margin: 0 0 20px; color: ${INK}; font-size: 15px; line-height: 1.5;">
      Tu sesión en el panel se cerró por inactividad. Usa este código para volver a ingresar:
    </p>
    <div style="text-align: center; background-color: #f7f5fa; border-left: 4px solid ${PURPLE}; border-radius: 8px; padding: 20px; margin: 0 0 20px;">
      <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: ${PURPLE};">${codigo}</span>
    </div>
    <p style="margin: 0; color: ${SLATE}; font-size: 13px; line-height: 1.5;">Vence en 5 minutos. Si tú no lo pediste, ignora este correo.</p>
  `);
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
    subject: 'Credenciales al Panel de Mediaudience Latam',
    html: plantillaInvitacion({ nombre, email, password, rol }),
  });
}

export async function enviarCodigoAcceso({ nombre, email, codigo }) {
  return enviarCorreo({
    to: email,
    subject: 'Tu código para reingresar a Mediaudience Panel',
    html: plantillaCodigoAcceso({ nombre, codigo }),
  });
}

export async function enviarRecuperacion({ nombre, email, token }) {
  const enlace = `${PANEL_URL}restablecer-password?token=${token}`;
  return enviarCorreo({
    to: email,
    subject: 'Restablecer tu contraseña de Mediaudience Panel',
    html: plantillaRecuperacion({ nombre, enlace }),
  });
}
