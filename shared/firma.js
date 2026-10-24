// Firma de correo del layout "Signal" (manual de marca v1.0, sección 07).
// Lo usan el generador del hub (src/pages/marca/Firmas.jsx) y cualquier
// script que necesite la misma firma: un solo lugar define el diseño.
//
// Es HTML de correo, no de web: tablas, estilos inline y nada de CSS
// externo, porque Gmail/Outlook descartan <style> y las fuentes web. Las
// fuentes de marca (Space Grotesk/Plex) quedan como primera opción para
// Apple Mail, que sí las respeta; el resto cae a Arial. Lo que tiene que
// verse exacto (wordmark e isotipo) va como imagen servida desde el hub.

const TEMAS = {
  oscuro: {
    fondo: "#0A0E17",
    borde: "#1A2135",
    nombre: "#E9EDF6",
    texto: "#8A93A9",
    acento: "#58B0FF",
    divisor: "#1A2135",
    isotipo: "firma/isotipo-oscuro.png",
    wordmark: "firma/wordmark-oscuro.png",
  },
  claro: {
    fondo: "#FFFFFF",
    borde: "#E9EDF6",
    nombre: "#0A0E17",
    texto: "#565E76",
    acento: "#1F74BF",
    divisor: "#E9EDF6",
    isotipo: "firma/isotipo-claro.png",
    wordmark: "firma/wordmark-claro.png",
  },
};

const CANALES = "CTV · MOBILE PUSH · PROGRAMMATIC · GAMING";
const SANS = "'IBM Plex Sans',Arial,Helvetica,sans-serif";
const DISPLAY = "'Space Grotesk',Arial,Helvetica,sans-serif";

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// "+51 997 582 580" -> "+51997582580" para el href tel:
function telHref(tel) {
  return "tel:" + String(tel).replace(/[^\d+]/g, "");
}

export function firmaHtml({ nombre, cargo, pais, telefono, email, tema = "oscuro", baseUrl }) {
  const t = TEMAS[tema] || TEMAS.oscuro;
  const base = String(baseUrl || "").replace(/\/$/, "");
  const empresa = pais ? `Mediaudience ${pais}` : "Mediaudience";
  const linea = (contenido) =>
    `<tr><td style="padding:0;font-family:${SANS};font-size:13px;line-height:20px;color:${t.texto};">${contenido}</td></tr>`;

  return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:separate;background:${t.fondo};border:1px solid ${t.borde};border-radius:10px;" bgcolor="${t.fondo}">
<tr><td style="padding:20px 24px 18px 20px;">
<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">
<tr>
<td valign="top" style="padding:2px 18px 0 0;"><img src="${base}/${t.isotipo}" width="56" height="56" alt="Mediaudience" style="display:block;border:0;width:56px;height:56px;"></td>
<td valign="top" style="border-left:1px solid ${t.divisor};padding:0 0 0 18px;">
<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">
<tr><td style="padding:0;font-family:${DISPLAY};font-size:18px;line-height:24px;font-weight:bold;color:${t.nombre};">${esc(nombre)}</td></tr>
${cargo ? `<tr><td style="padding:2px 0 0 0;font-family:${SANS};font-size:14px;line-height:20px;font-weight:bold;color:${t.acento};">${esc(cargo)}</td></tr>` : ""}
${linea(esc(empresa))}
<tr><td style="padding:8px 0 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
${telefono ? linea(`<a href="${esc(telHref(telefono))}" style="color:${t.nombre};text-decoration:none;">${esc(telefono)}</a>`) : ""}
${email ? linea(`<a href="mailto:${esc(email)}" style="color:${t.acento};text-decoration:none;">${esc(email)}</a>`) : ""}
</table>
</td>
</tr>
</table>
</td></tr>
<tr><td style="padding:0 24px 0 20px;"><table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%" style="border-collapse:collapse;"><tr><td style="border-top:1px solid ${t.divisor};font-size:0;line-height:0;height:1px;">&nbsp;</td></tr></table></td></tr>
<tr><td style="padding:12px 24px 14px 20px;">
<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%" style="border-collapse:collapse;">
<tr>
<td valign="middle" style="padding:0;"><a href="https://mediaudience.com" style="text-decoration:none;"><img src="${base}/${t.wordmark}" width="106" height="20" alt="mediaudience" style="display:block;border:0;width:106px;height:20px;"></a></td>
<td valign="middle" align="right" style="padding:0 0 0 24px;font-family:'JetBrains Mono','Courier New',monospace;font-size:10px;line-height:14px;letter-spacing:1px;color:${t.acento};white-space:nowrap;">${CANALES}</td>
</tr>
</table>
</td></tr>
</table>`;
}

export const FIRMA_TEMAS = Object.keys(TEMAS);
