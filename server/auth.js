import { Router } from "express";
import bcrypt from "bcrypt";
import db from "./db.js";
import { requireUser } from "./middleware.js";

const router = Router();

function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    nombre: user.nombre,
    rol: user.rol,
    clienteId: user.cliente_id,
  };
}

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email y contraseña son requeridos" });
  }

  const user = db.prepare("SELECT * FROM users WHERE email = ? AND activo = 1").get(email);
  const valido = user && (await bcrypt.compare(password, user.password_hash));
  if (!valido) {
    return res.status(401).json({ error: "Email o contraseña incorrectos" });
  }

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: "No se pudo iniciar sesión" });
    req.session.userId = user.id;
    db.prepare("UPDATE users SET ultimo_login = datetime('now') WHERE id = ?").run(user.id);
    res.json({ user: toPublicUser(user) });
  });
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

export default router;
