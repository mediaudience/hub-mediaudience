import bcrypt from 'bcrypt'
import db from './db.js'

const ROLES_SIN_CLIENTE = ['super_admin', 'admin', 'usuario_interno']

const [, , email, password, nombre, rol = 'admin'] = process.argv

if (!email || !password || !nombre) {
  console.error('Uso: node server/seed-admin.js <email> <password> <"Nombre Completo"> [rol]')
  console.error(`Roles válidos: ${ROLES_SIN_CLIENTE.join(', ')} (usuario_externo requiere cliente, usar el panel)`)
  process.exit(1)
}
if (!ROLES_SIN_CLIENTE.includes(rol)) {
  console.error(`Rol inválido: ${rol}. Roles válidos: ${ROLES_SIN_CLIENTE.join(', ')}`)
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
).run(email, passwordHash, nombre, rol)

console.log(`Usuario creado (${rol}): ${email}`)
