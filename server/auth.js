import { Router } from "express";
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import db from "./db.js";
import { requireUser } from "./middleware.js";
import { enviarCodigoAcceso, enviarRecuperacion } from "./email.js";
import { getCanalesContratados } from "./dataAccess.js";
import { registrarActividad } from "./activityLog.js";

const router = Router();

const LOGIN_MAX_INTENTOS = 5;
const LOGIN_BLOQUEO_MS = 1000 * 60 * 15;
const OTP_EXPIRA_MS = 1000 * 60 * 5;
const OTP_MAX_INTENTOS = 5;
const OTP_REENVIO_MIN_MS = 1000 * 30;
const RESET_EXPIRA_MS = 1000 * 60 * 30;
const RESET_REENVIO_MIN_MS = 1000 * 60;

function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    nombre: user.nombre,
    rol: user.rol,
    clienteId: user.cliente_id,
    debeCambiarPassword: !!user.debe_cambiar_password,
    canalesContratados: getCanalesContratados({ id: user.id, rol: user.rol, clienteId: user.cliente_id }),
  };
}

function iniciarSesion(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      const ahora = Date.now();
      req.session.userId = user.id;
      req.session.ultimaActividad = ahora;
      req.session.iniciadaEn = ahora;
      resolve();
    });
  });
}

function hashCodigo(codigo) {
  return crypto.createHash("sha256").update(codigo).digest("hex");
}

// Igual que hashCodigo -- se guarda el hash, nunca el token en claro, así una
// fuga de la base no alcanza para restablecer contraseñas ajenas.
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Genera y manda un código nuevo salvo que ya se haya mandado uno hace menos
// de OTP_REENVIO_MIN_MS -- en ese caso el código vigente sigue siendo válido,
// no hace falta mandar otro. Usado tanto al completar /login con requiere_otp
// como por el botón "Reenviar código".
async function mandarCodigoSiCorresponde(user) {
  const ultimo = db
    .prepare("SELECT created_at FROM login_otps WHERE user_id = ? ORDER BY id DESC LIMIT 1")
    .get(user.id);
  if (ultimo && Date.now() - new Date(ultimo.created_at).getTime() < OTP_REENVIO_MIN_MS) {
    return { enviado: false };
  }

  const codigo = crypto.randomInt(0, 10000).toString().padStart(4, "0");
  db.prepare(
    "INSERT INTO login_otps (user_id, codigo_hash, expira_en) VALUES (?, ?, ?)"
  ).run(user.id, hashCodigo(codigo), new Date(Date.now() + OTP_EXPIRA_MS).toISOString());

  await enviarCodigoAcceso({ nombre: user.nombre, email: user.email, codigo });
  return { enviado: true };
}

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email y contraseña son requeridos" });
  }

  const user = db.prepare("SELECT * FROM users WHERE email = ? AND activo = 1").get(email);

  if (user?.bloqueado_hasta && new Date(user.bloqueado_hasta).getTime() > Date.now()) {
    const minutos = Math.ceil((new Date(user.bloqueado_hasta).getTime() - Date.now()) / 60000);
    registrarActividad(req, { actor: user, accion: "Intento de inicio fallido", detalle: "Cuenta bloqueada por intentos fallidos" });
    return res.status(429).json({ error: `Demasiados intentos fallidos. Intenta de nuevo en ${minutos} min.` });
  }

  const valido = user && (await bcrypt.compare(password, user.password_hash));
  if (!valido) {
    if (user) {
      const intentos = user.intentos_fallidos + 1;
      const bloqueadoHasta = intentos >= LOGIN_MAX_INTENTOS ? new Date(Date.now() + LOGIN_BLOQUEO_MS).toISOString() : null;
      db.prepare("UPDATE users SET intentos_fallidos = ?, bloqueado_hasta = ? WHERE id = ?").run(
        intentos,
        bloqueadoHasta,
        user.id
      );
    }
    registrarActividad(req, {
      actor: user,
      actorEmail: email,
      accion: "Intento de inicio fallido",
      detalle: user ? "Contraseña incorrecta" : "Email no registrado",
    });
    return res.status(401).json({ error: "Email o contraseña incorrectos" });
  }

  db.prepare(
    "UPDATE users SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?"
  ).run(user.id);

  // La contraseña es correcta, pero la sesión anterior de este usuario cerró
  // por inactividad (server/middleware.js) -- en vez de entrar de una, se le
  // manda el código al correo y recién se completa el login en /otp/verificar.
  if (user.requiere_otp) {
    await mandarCodigoSiCorresponde(user);
    return res.json({ requiereOtp: true, email: user.email });
  }

  db.prepare("UPDATE users SET ultimo_login = datetime('now') WHERE id = ?").run(user.id);

  try {
    await iniciarSesion(req, user);
  } catch {
    return res.status(500).json({ error: "No se pudo iniciar sesión" });
  }
  registrarActividad(req, { actor: user, accion: "Inicio de sesión" });
  res.json({ user: toPublicUser(user) });
});

router.post("/logout", (req, res) => {
  const user = req.session.userId
    ? db.prepare("SELECT id, email FROM users WHERE id = ?").get(req.session.userId)
    : null;
  if (user) registrarActividad(req, { actor: user, accion: "Cierre de sesión" });
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

router.get("/me", requireUser, (req, res) => {
  res.json({ user: req.user });
});

router.post("/cambiar-password", requireUser, async (req, res) => {
  const { passwordActual, passwordNueva } = req.body || {};
  if (!passwordActual || !passwordNueva || passwordNueva.length < 8) {
    return res.status(400).json({ error: "La nueva contraseña debe tener al menos 8 caracteres" });
  }

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  const valido = await bcrypt.compare(passwordActual, user.password_hash);
  if (!valido) {
    return res.status(401).json({ error: "La contraseña actual no es correcta" });
  }

  const passwordHash = await bcrypt.hash(passwordNueva, 12);
  db.prepare("UPDATE users SET password_hash = ?, debe_cambiar_password = 0 WHERE id = ?").run(
    passwordHash,
    user.id
  );
  registrarActividad(req, { actor: user, accion: "Cambio de contraseña" });
  res.json({ ok: true });
});

// Reenvío del código pedido en /login (botón "Reenviar código" de
// VerificarCodigo.jsx) -- nunca manda un código si no hay un reingreso
// pendiente (requiere_otp = 0), para no mandar correos sin que nadie esté
// intentando entrar.
router.post("/otp/solicitar", async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "Email es requerido" });

  const user = db.prepare("SELECT * FROM users WHERE email = ? AND activo = 1").get(email);
  // Respuesta idéntica exista o no el usuario (o no tenga reingreso
  // pendiente), para no dar pistas de qué correos están registrados.
  if (!user || !user.requiere_otp) return res.json({ ok: true });

  const { enviado } = await mandarCodigoSiCorresponde(user);
  if (!enviado) {
    return res.status(429).json({ error: "Espera unos segundos antes de pedir otro código" });
  }
  res.json({ ok: true });
});

router.post("/otp/verificar", async (req, res) => {
  const { email, codigo } = req.body || {};
  if (!email || !codigo) return res.status(400).json({ error: "Email y código son requeridos" });

  const user = db.prepare("SELECT * FROM users WHERE email = ? AND activo = 1").get(email);
  const otp = user
    ? db
        .prepare(
          "SELECT * FROM login_otps WHERE user_id = ? AND usado = 0 AND expira_en > datetime('now') ORDER BY id DESC LIMIT 1"
        )
        .get(user.id)
    : null;

  if (!user || !otp || otp.intentos >= OTP_MAX_INTENTOS) {
    return res.status(401).json({ error: "Código inválido o vencido" });
  }

  if (hashCodigo(codigo) !== otp.codigo_hash) {
    db.prepare("UPDATE login_otps SET intentos = intentos + 1 WHERE id = ?").run(otp.id);
    return res.status(401).json({ error: "Código inválido o vencido" });
  }

  db.prepare("UPDATE login_otps SET usado = 1 WHERE id = ?").run(otp.id);
  db.prepare("UPDATE users SET requiere_otp = 0, ultimo_login = datetime('now') WHERE id = ?").run(user.id);

  try {
    await iniciarSesion(req, user);
  } catch {
    return res.status(500).json({ error: "No se pudo iniciar sesión" });
  }
  registrarActividad(req, { actor: user, accion: "Inicio de sesión", detalle: "Vía código de reingreso" });
  res.json({ user: toPublicUser(user) });
});

// Paso 1 del self-service "¿Has olvidado tu contraseña?": pide el email desde
// Login.jsx y, si existe una cuenta activa con ese correo, manda un enlace de
// un solo uso a /restablecer-password. Responde igual exista o no el usuario
// (mismo criterio que /otp/solicitar), para no dar pistas de qué correos
// están registrados.
router.post("/olvide-password", async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "Email es requerido" });

  const user = db.prepare("SELECT * FROM users WHERE email = ? AND activo = 1").get(email);
  if (!user) return res.json({ ok: true });

  const ultimo = db
    .prepare("SELECT created_at FROM password_reset_tokens WHERE user_id = ? ORDER BY id DESC LIMIT 1")
    .get(user.id);
  if (ultimo && Date.now() - new Date(ultimo.created_at).getTime() < RESET_REENVIO_MIN_MS) {
    return res.json({ ok: true });
  }

  const token = crypto.randomBytes(32).toString("hex");
  db.prepare("INSERT INTO password_reset_tokens (user_id, token_hash, expira_en) VALUES (?, ?, ?)").run(
    user.id,
    hashToken(token),
    new Date(Date.now() + RESET_EXPIRA_MS).toISOString()
  );

  await enviarRecuperacion({ nombre: user.nombre, email: user.email, token });
  res.json({ ok: true });
});

// Paso 2: RestablecerPassword.jsx llama esto con el token de la URL del
// correo. Un token válido deja entrar sin pedir la contraseña vieja (es
// justamente para cuando no la recuerdas) y de paso levanta cualquier bloqueo
// por intentos fallidos, ya que probar el correo ya demuestra que sos el dueño
// de la cuenta.
router.post("/restablecer-password", async (req, res) => {
  const { token, passwordNueva } = req.body || {};
  if (!token || !passwordNueva || passwordNueva.length < 8) {
    return res.status(400).json({ error: "La nueva contraseña debe tener al menos 8 caracteres" });
  }

  const registro = db
    .prepare(
      "SELECT * FROM password_reset_tokens WHERE token_hash = ? AND usado = 0 AND expira_en > datetime('now')"
    )
    .get(hashToken(token));
  if (!registro) return res.status(400).json({ error: "El enlace es inválido o ya venció. Pide uno nuevo." });

  const passwordHash = await bcrypt.hash(passwordNueva, 12);
  db.prepare(
    "UPDATE users SET password_hash = ?, debe_cambiar_password = 0, intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?"
  ).run(passwordHash, registro.user_id);
  db.prepare("UPDATE password_reset_tokens SET usado = 1 WHERE user_id = ? AND usado = 0").run(registro.user_id);

  const user = db.prepare("SELECT id, email FROM users WHERE id = ?").get(registro.user_id);
  registrarActividad(req, { actor: user, accion: "Restablecimiento de contraseña", detalle: "Vía enlace de \"olvidé mi contraseña\"" });
  res.json({ ok: true });
});

export default router;
