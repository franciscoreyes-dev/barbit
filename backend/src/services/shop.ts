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

export interface ShopStats {
  totalConfirmed: number
  totalCancelled: number
  totalCompleted: number
  totalNoShow: number
  revenue: number
  expectedRevenue: number
  noShowRate: number
  avgBookingsPerBarber: number
  mostRequestedService: { name: string; count: number } | null
  busiestBarber: { name: string; count: number } | null
  appointmentsPerDay: Array<{ date: string; count: number }>
  busiestHours: Array<{ hour: number; count: number }>
  serviceBreakdown: Array<{ name: string; count: number; revenue: number }>
  barberBreakdown: Array<{ name: string; count: number; revenue: number }>
}

export async function getShopStats(
  shopId: string,
  from: string,
  to: string,
  user: OwnerBarberPayload,
  barberIds?: string[]
): Promise<ShopStats> {
  if (user.shopId !== shopId) throw new AppError('FORBIDDEN', 403)

  const dateFilter = `AND start_time >= $2::date AND start_time < ($3::date + interval '1 day')`
  const baseParams: unknown[] = [shopId, from, to]
  let barberFilter = ''
  if (barberIds && barberIds.length > 0) {
    baseParams.push(barberIds)
    barberFilter = ` AND barber_id = ANY($${baseParams.length}::uuid[])`
  }

  const statusRes = await db.query(
    `SELECT status, COUNT(*) AS count FROM appointments
     WHERE shop_id = $1 ${dateFilter}${barberFilter}
     GROUP BY status`,
    baseParams
  )
  const statusCounts: Record<string, number> = {}
  for (const r of statusRes.rows) statusCounts[r.status] = Number(r.count)
  const totalConfirmed = (statusCounts['confirmed'] ?? 0) + (statusCounts['completed'] ?? 0)
  const totalCancelled = statusCounts['cancelled'] ?? 0
  const totalCompleted = statusCounts['completed'] ?? 0
  const totalNoShow = statusCounts['no_show'] ?? 0
  const totalNonCancelled = totalConfirmed + totalNoShow
  const noShowRate = totalNonCancelled > 0 ? Math.round((totalNoShow / totalNonCancelled) * 100) : 0

  const revenueRes = await db.query(
    `SELECT COALESCE(SUM(bs.price), 0) AS revenue FROM appointments a
     JOIN barber_services bs ON bs.id = a.barber_service_id
     WHERE a.shop_id = $1 AND a.status = 'completed' ${dateFilter}${barberFilter.replace('barber_id', 'a.barber_id')}`,
    baseParams
  )
  const revenue = Number(revenueRes.rows[0].revenue)

  const expectedRevenueRes = await db.query(
    `SELECT COALESCE(SUM(bs.price), 0) AS expected FROM appointments a
     JOIN barber_services bs ON bs.id = a.barber_service_id
     WHERE a.shop_id = $1 AND a.status != 'cancelled' ${dateFilter}${barberFilter.replace('barber_id', 'a.barber_id')}`,
    baseParams
  )
  const expectedRevenue = Number(expectedRevenueRes.rows[0].expected)

  const barberCountRes = await db.query(
    `SELECT COUNT(DISTINCT id) AS cnt FROM barbers WHERE shop_id = $1 AND is_active = true`,
    [shopId]
  )
  const barberCount = Number(barberCountRes.rows[0].cnt) || 1
  const avgBookingsPerBarber = Math.round((totalNonCancelled / barberCount) * 10) / 10

  const serviceRes = await db.query(
    `SELECT bs.name, COUNT(*) AS count FROM appointments a
     JOIN barber_services bs ON bs.id = a.barber_service_id
     WHERE a.shop_id = $1 AND a.status != 'cancelled' ${dateFilter}${barberFilter.replace('barber_id', 'a.barber_id')}
     GROUP BY bs.name ORDER BY count DESC LIMIT 1`,
    baseParams
  )
  const mostRequestedService = serviceRes.rows[0]
    ? { name: serviceRes.rows[0].name, count: Number(serviceRes.rows[0].count) }
    : null

  const barberRes = await db.query(
    `SELECT b.name, COUNT(*) AS count FROM appointments a
     JOIN barbers b ON b.id = a.barber_id
     WHERE a.shop_id = $1 AND a.status != 'cancelled' ${dateFilter}${barberFilter.replace('barber_id', 'a.barber_id')}
     GROUP BY b.name ORDER BY count DESC LIMIT 1`,
    baseParams
  )
  const busiestBarber = barberRes.rows[0]
    ? { name: barberRes.rows[0].name, count: Number(barberRes.rows[0].count) }
    : null

  const perDayRes = await db.query(
    `SELECT DATE(start_time AT TIME ZONE 'UTC') AS date, COUNT(*) AS count
     FROM appointments
     WHERE shop_id = $1 AND status != 'cancelled' ${dateFilter}${barberFilter}
     GROUP BY DATE(start_time AT TIME ZONE 'UTC')
     ORDER BY date`,
    baseParams
  )
  const appointmentsPerDay = perDayRes.rows.map(r => ({
    date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date),
    count: Number(r.count),
  }))

  const hoursRes = await db.query(
    `SELECT EXTRACT(HOUR FROM start_time AT TIME ZONE 'UTC')::int AS hour, COUNT(*) AS count
     FROM appointments
     WHERE shop_id = $1 AND status != 'cancelled' ${dateFilter}${barberFilter}
     GROUP BY hour ORDER BY hour`,
    baseParams
  )
  const busiestHours = hoursRes.rows.map(r => ({ hour: Number(r.hour), count: Number(r.count) }))

  const svcBreakdownRes = await db.query(
    `SELECT bs.name, COUNT(*) AS count,
            COALESCE(SUM(CASE WHEN a.status = 'completed' THEN bs.price ELSE 0 END), 0) AS revenue
     FROM appointments a
     JOIN barber_services bs ON bs.id = a.barber_service_id
     WHERE a.shop_id = $1 AND a.status != 'cancelled' ${dateFilter}${barberFilter.replace('barber_id', 'a.barber_id')}
     GROUP BY bs.name ORDER BY count DESC`,
    baseParams
  )
  const serviceBreakdown = svcBreakdownRes.rows.map(r => ({
    name: r.name as string, count: Number(r.count), revenue: Number(r.revenue),
  }))

  const barberBreakdownRes = await db.query(
    `SELECT b.name, COUNT(*) AS count,
            COALESCE(SUM(CASE WHEN a.status = 'completed' THEN bs.price ELSE 0 END), 0) AS revenue
     FROM appointments a
     JOIN barbers b ON b.id = a.barber_id
     JOIN barber_services bs ON bs.id = a.barber_service_id
     WHERE a.shop_id = $1 AND a.status != 'cancelled' ${dateFilter}${barberFilter.replace('barber_id', 'a.barber_id')}
     GROUP BY b.name ORDER BY count DESC`,
    baseParams
  )
  const barberBreakdown = barberBreakdownRes.rows.map(r => ({
    name: r.name as string, count: Number(r.count), revenue: Number(r.revenue),
  }))

  return {
    totalConfirmed, totalCancelled, totalCompleted, totalNoShow,
    revenue, expectedRevenue, noShowRate, avgBookingsPerBarber,
    mostRequestedService, busiestBarber, appointmentsPerDay,
    busiestHours, serviceBreakdown, barberBreakdown,
  }
}
