import { Router } from "express";
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import db from "./db.js";
import { requireUser } from "./middleware.js";
import { enviarCodigoAcceso } from "./email.js";

const router = Router();

const LOGIN_MAX_INTENTOS = 5;
const LOGIN_BLOQUEO_MS = 1000 * 60 * 15;
const OTP_EXPIRA_MS = 1000 * 60 * 5;
const OTP_MAX_INTENTOS = 5;
const OTP_REENVIO_MIN_MS = 1000 * 30;

function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    nombre: user.nombre,
    rol: user.rol,
    clienteId: user.cliente_id,
    debeCambiarPassword: !!user.debe_cambiar_password,
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

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email y contraseña son requeridos" });
  }

  const user = db.prepare("SELECT * FROM users WHERE email = ? AND activo = 1").get(email);

  if (user?.bloqueado_hasta && new Date(user.bloqueado_hasta).getTime() > Date.now()) {
    const minutos = Math.ceil((new Date(user.bloqueado_hasta).getTime() - Date.now()) / 60000);
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
    return res.status(401).json({ error: "Email o contraseña incorrectos" });
  }

  db.prepare(
    "UPDATE users SET ultimo_login = datetime('now'), intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?"
  ).run(user.id);

  try {
    await iniciarSesion(req, user);
  } catch {
    return res.status(500).json({ error: "No se pudo iniciar sesión" });
  }
  res.json({ user: toPublicUser(user) });
});

router.post("/logout", (req, res) => {
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
  res.json({ ok: true });
});

// Reingreso por código de un solo uso enviado al correo, para retomar sin
// contraseña una sesión que expiró por inactividad (ver server/middleware.js).
router.post("/otp/solicitar", async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "Email es requerido" });

  const user = db.prepare("SELECT * FROM users WHERE email = ? AND activo = 1").get(email);
  // Respuesta idéntica exista o no el usuario, para no dar pistas de qué
  // correos están registrados.
  if (!user) return res.json({ ok: true });

  const ultimo = db
    .prepare("SELECT created_at FROM login_otps WHERE user_id = ? ORDER BY id DESC LIMIT 1")
    .get(user.id);
  if (ultimo && Date.now() - new Date(ultimo.created_at).getTime() < OTP_REENVIO_MIN_MS) {
    return res.status(429).json({ error: "Espera unos segundos antes de pedir otro código" });
  }

  const codigo = crypto.randomInt(0, 10000).toString().padStart(4, "0");
  db.prepare(
    "INSERT INTO login_otps (user_id, codigo_hash, expira_en) VALUES (?, ?, ?)"
  ).run(user.id, hashCodigo(codigo), new Date(Date.now() + OTP_EXPIRA_MS).toISOString());

  await enviarCodigoAcceso({ nombre: user.nombre, email: user.email, codigo });
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

  try {
    await iniciarSesion(req, user);
  } catch {
    return res.status(500).json({ error: "No se pudo iniciar sesión" });
  }
  res.json({ user: toPublicUser(user) });
});

export default router;
