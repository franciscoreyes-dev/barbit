import slugify from 'slugify'
import { db } from '../db/pool'
import { AppError } from '../lib/errors'
import { OwnerBarberPayload } from '../lib/jwt'

export interface ShopSearchResult {
  id: string
  name: string
  slug: string
  city: string | null
  address: string | null
}

interface ServiceSummary {
  id: string
  name: string
  duration_minutes: number
  price: string | null
}

export interface ShopProfile extends ShopSearchResult {
  phone: string | null
  email: string | null
  timezone: string
  barbers: Array<{ id: string; name: string; avatar_url: string | null; services: ServiceSummary[] }>
}

export interface UpdateShopInput {
  name?: string
  address?: string
  city?: string
  phone?: string
  email?: string
  timezone?: string
}

export async function searchShops(q?: string, city?: string): Promise<ShopSearchResult[]> {
  const conditions: string[] = []
  const params: string[] = []

  if (q) {
    params.push(`%${q}%`)
    conditions.push(`name ILIKE $${params.length}`)
  }

  if (city) {
    params.push(`%${city}%`)
    conditions.push(`city ILIKE $${params.length}`)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' OR ')}` : ''
  const sql = `SELECT id, name, slug, city, address FROM shops ${whereClause} ORDER BY name LIMIT 50`

  const res = await db.query(sql, params)
  return res.rows as ShopSearchResult[]
}

export async function getShopBySlug(slug: string): Promise<{ shop: ShopProfile; barbers: unknown[] }> {
  const shopRes = await db.query(
    `SELECT id, name, slug, city, address, phone, email, timezone FROM shops WHERE slug = $1`,
    [slug]
  )

  const shop = shopRes.rows[0]
  if (!shop) throw new AppError('SHOP_NOT_FOUND', 404)

  const barbersRes = await db.query(
    `SELECT id, user_id, name, avatar_url, is_active FROM barbers WHERE shop_id = $1 AND is_active = true`,
    [shop.id]
  )

  const barbers = await Promise.all(
    (barbersRes.rows as Array<{ id: string; user_id: string; name: string; avatar_url: string | null }>).map(async (barber) => {
      const servicesRes = await db.query(
        `SELECT id, name, duration_minutes, price, is_active FROM barber_services WHERE barber_id = $1 AND is_active = true`,
        [barber.id]
      )
      return { ...barber, services: servicesRes.rows as ServiceSummary[] }
    })
  )

  return { shop, barbers }
}

export async function getShopById(shopId: string): Promise<Record<string, unknown>> {
  const { rows } = await db.query(
    'SELECT id, name, slug, address, city, phone, email, timezone FROM shops WHERE id = $1',
    [shopId]
  )
  if (!rows[0]) throw new AppError('SHOP_NOT_FOUND', 404)
  return rows[0]
}

export async function updateShop(shopId: string, user: OwnerBarberPayload, data: UpdateShopInput): Promise<void> {
  if (user.shopId !== shopId) throw new AppError('FORBIDDEN', 403)

  const fields = Object.keys(data) as Array<keyof UpdateShopInput>
  if (fields.length === 0) return

  let slug: string | undefined
  if (data.name !== undefined) {
    slug = slugify(data.name, { lower: true, strict: true })
    const conflictRes = await db.query(
      `SELECT id FROM shops WHERE slug = $1 AND id != $2`,
      [slug, shopId]
    )
    if (conflictRes.rows.length > 0) throw new AppError('SLUG_TAKEN', 409)
  }

  const setClauses: string[] = []
  const params: unknown[] = []

  for (const field of fields) {
    params.push(data[field])
    setClauses.push(`${field} = $${params.length}`)
  }

  if (slug !== undefined) {
    params.push(slug)
    setClauses.push(`slug = $${params.length}`)
  }

  params.push(shopId)
  const sql = `UPDATE shops SET ${setClauses.join(', ')} WHERE id = $${params.length}`

  await db.query(sql, params)
}
