import { db } from '../db/pool'
import { AppError } from '../lib/errors'
import { OwnerBarberPayload } from '../lib/jwt'
import { authorizeBarberAccess } from '../lib/guard'

export interface CatalogItem {
  id: string
  name: string
  default_duration_minutes: number
  category: string
}

export interface BarberService {
  id: string
  barber_id: string
  service_catalog_id: string | null
  name: string
  duration_minutes: number
  price: string | null
  is_active: boolean
}

export interface AddServiceInput {
  service_catalog_id?: string
  name: string
  duration_minutes: number
  price?: number
}

export interface UpdateServiceInput {
  name?: string
  duration_minutes?: number
  price?: number
}

async function fetchBarber(barberId: string) {
  const res = await db.query(
    `SELECT id, user_id, shop_id FROM barbers WHERE id = $1`,
    [barberId]
  )
  return res.rows[0] ?? null
}

export async function listCatalog(): Promise<CatalogItem[]> {
  const res = await db.query(
    `SELECT id, name, default_duration_minutes, category FROM service_catalog ORDER BY category, name`
  )
  return res.rows as CatalogItem[]
}

export async function listBarberServices(barberId: string): Promise<BarberService[]> {
  const res = await db.query(
    `SELECT id, barber_id, service_catalog_id, name, duration_minutes, price, is_active FROM barber_services WHERE barber_id = $1 AND is_active = true ORDER BY name`,
    [barberId]
  )
  return res.rows as BarberService[]
}

export async function addBarberService(
  barberId: string,
  user: OwnerBarberPayload,
  data: AddServiceInput
): Promise<BarberService> {
  const barber = await fetchBarber(barberId)
  if (!barber) throw new AppError('BARBER_NOT_FOUND', 404)

  authorizeBarberAccess(barber, user)

  const res = await db.query(
    `INSERT INTO barber_services (barber_id, service_catalog_id, name, duration_minutes, price)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, barber_id, service_catalog_id, name, duration_minutes, price, is_active`,
    [barberId, data.service_catalog_id ?? null, data.name, data.duration_minutes, data.price ?? null]
  )

  return res.rows[0] as BarberService
}

export async function updateBarberService(
  barberId: string,
  serviceId: string,
  user: OwnerBarberPayload,
  data: UpdateServiceInput
): Promise<void> {
  const barber = await fetchBarber(barberId)
  if (!barber) throw new AppError('BARBER_NOT_FOUND', 404)

  authorizeBarberAccess(barber, user)

  const serviceRes = await db.query(
    `SELECT id FROM barber_services WHERE id = $1 AND barber_id = $2`,
    [serviceId, barberId]
  )
  if (serviceRes.rows.length === 0) throw new AppError('SERVICE_NOT_FOUND', 404)

  const fields = Object.keys(data) as Array<keyof UpdateServiceInput>
  if (fields.length === 0) return

  const setClauses: string[] = []
  const params: unknown[] = []

  for (const field of fields) {
    params.push(data[field])
    setClauses.push(`${field} = $${params.length}`)
  }

  params.push(serviceId)
  const sql = `UPDATE barber_services SET ${setClauses.join(', ')} WHERE id = $${params.length}`

  await db.query(sql, params)
}

export async function deleteBarberService(
  barberId: string,
  serviceId: string,
  user: OwnerBarberPayload
): Promise<void> {
  const barber = await fetchBarber(barberId)
  if (!barber) throw new AppError('BARBER_NOT_FOUND', 404)

  authorizeBarberAccess(barber, user)

  const serviceRes = await db.query(
    `SELECT id FROM barber_services WHERE id = $1 AND barber_id = $2`,
    [serviceId, barberId]
  )
  if (serviceRes.rows.length === 0) throw new AppError('SERVICE_NOT_FOUND', 404)

  await db.query(`UPDATE barber_services SET is_active = false WHERE id = $1`, [serviceId])
}
