import bcrypt from 'bcrypt'
import slugify from 'slugify'
import { db } from '../db/pool'
import { AppError } from '../lib/errors'
import { signToken } from '../lib/jwt'

export interface RegisterInput {
  email: string
  password: string
  shopName: string
  shopCity: string
}

export async function registerOwner(data: RegisterInput) {
  const { email, password, shopName, shopCity } = data

  const existing = await db.query('SELECT id FROM users WHERE email = $1', [email])
  if (existing.rows.length > 0) throw new AppError('EMAIL_TAKEN', 409)

  const slug = slugify(shopName, { lower: true, strict: true })

  const shopRes = await db.query(
    `INSERT INTO shops (name, slug, city) VALUES ($1, $2, $3) RETURNING *`,
    [shopName, slug, shopCity]
  )
  const shop = shopRes.rows[0]

  const passwordHash = await bcrypt.hash(password, 12)
  const userRes = await db.query(
    `INSERT INTO users (email, password_hash, role, shop_id, is_active)
     VALUES ($1, $2, 'owner', $3, true) RETURNING *`,
    [email, passwordHash, shop.id]
  )
  const user = userRes.rows[0]

  await db.query(
    `INSERT INTO barbers (user_id, shop_id, name) VALUES ($1, $2, $3) RETURNING *`,
    [user.id, shop.id, email.split('@')[0]]
  )

  const token = signToken({ userId: user.id, role: 'owner', shopId: shop.id })
  return { token }
}

export async function login(email: string, password: string) {
  const res = await db.query(
    `SELECT id, email, password_hash, role, shop_id, is_active FROM users WHERE email = $1`,
    [email]
  )
  const user = res.rows[0]
  if (!user) throw new AppError('INVALID_CREDENTIALS', 401)

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) throw new AppError('INVALID_CREDENTIALS', 401)

  if (!user.is_active) throw new AppError('ACCOUNT_INACTIVE', 403)

  const token = signToken({ userId: user.id, role: user.role, shopId: user.shop_id })
  return { token }
}
