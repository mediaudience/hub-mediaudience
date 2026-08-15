import bcrypt from 'bcrypt'
import db from './db.js'

const [, , email, password, nombre] = process.argv

if (!email || !password || !nombre) {
  console.error('Uso: node server/seed-admin.js <email> <password> <"Nombre Completo">')
  process.exit(1)
}

const existente = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
if (existente) {
  console.error(`Ya existe un usuario con el email ${email}`)
  process.exit(1)
}

const passwordHash = await bcrypt.hash(password, 12)

db.prepare(
  'INSERT INTO users (email, password_hash, nombre, rol, cliente_id) VALUES (?, ?, ?, ?, NULL)'
).run(email, passwordHash, nombre, 'admin')

console.log(`Admin creado: ${email}`)
