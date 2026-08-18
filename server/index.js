import express from 'express'
import session from 'express-session'
import SQLiteStoreFactory from 'connect-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import './db.js'
import authRouter from './auth.js'
import dataRouter from './dataRoutes.js'
import adminRouter from './adminRoutes.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SQLiteStore = SQLiteStoreFactory(session)

if (!process.env.SESSION_SECRET) {
  throw new Error(
    'Falta SESSION_SECRET en el entorno. Define una cadena aleatoria larga antes de arrancar el servidor.'
  )
}

const app = express()
app.use(express.json())
app.use(
  session({
    store: new SQLiteStore({ db: 'sessions.sqlite', dir: __dirname }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      // Deliberadamente NO atado a NODE_ENV: el sitio hoy sirve por HTTP plano
      // (sin dominio ni certificado todavía), y `secure: true` sobre HTTP hace
      // que el navegador descarte la cookie -- el login "funciona" (200) pero
      // la sesión nunca persiste. Cambiar a 'true' en el entorno el día que
      // haya HTTPS real.
      secure: process.env.SESSION_COOKIE_SECURE === 'true',
      sameSite: 'strict',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
)

app.get('/api/health', (req, res) => {
  res.json({ ok: true })
})

app.use('/api/auth', authRouter)
app.use('/api/canal', dataRouter)
app.use('/api/admin', adminRouter)

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Error interno del servidor' })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`)
})
