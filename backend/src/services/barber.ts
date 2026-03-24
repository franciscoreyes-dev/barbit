import { db } from '../db/pool'
import { AppError } from '../lib/errors'
import { OwnerBarberPayload } from '../lib/jwt'
import { authorizeBarberAccess } from '../lib/guard'

export interface BarberWithServices {
  id: string
  user_id: string
  name: string
  avatar_url: string | null
  services: Array<{ id: string; name: string; duration_minutes: number; price: string | null }>
}

export interface UpdateBarberInput {
  name?: string
  avatar_url?: string
  is_active?: boolean
}

async function fetchBarber(barberId: string) {
  const res = await db.query(
    `SELECT id, user_id, shop_id, name, avatar_url, is_active FROM barbers WHERE id = $1`,
    [barberId]
  )
  return res.rows[0] ?? null
}

export async function listBarbers(shopId: string): Promise<BarberWithServices[]> {
  const barbersRes = await db.query(
    `SELECT id, user_id, name, avatar_url, is_active FROM barbers WHERE shop_id = $1 ORDER BY name`,
    [shopId]
  )

  const barbers = await Promise.all(
    (barbersRes.rows as Array<{ id: string; user_id: string; name: string; avatar_url: string | null }>).map(async (barber) => {
      const servicesRes = await db.query(
        `SELECT id, name, duration_minutes, price FROM barber_services WHERE barber_id = $1 AND is_active = true ORDER BY name`,
        [barber.id]
      )
      return { ...barber, services: servicesRes.rows as BarberWithServices['services'] }
    })
  )

  return barbers
}

export async function updateBarber(barberId: string, user: OwnerBarberPayload, data: UpdateBarberInput): Promise<void> {
  const barber = await fetchBarber(barberId)
  if (!barber) throw new AppError('BARBER_NOT_FOUND', 404)

  authorizeBarberAccess(barber, user)

  const fields = Object.keys(data) as Array<keyof UpdateBarberInput>
  if (fields.length === 0) return

  const setClauses: string[] = []
  const params: unknown[] = []

  for (const field of fields) {
    params.push(data[field])
    setClauses.push(`${field} = $${params.length}`)
  }

  params.push(barberId)
  const sql = `UPDATE barbers SET ${setClauses.join(', ')} WHERE id = $${params.length}`

  await db.query(sql, params)
}

export async function deactivateBarber(barberId: string, user: OwnerBarberPayload): Promise<void> {
  const barber = await fetchBarber(barberId)
  if (!barber) throw new AppError('BARBER_NOT_FOUND', 404)

  if (user.role !== 'owner' || barber.shop_id !== user.shopId) {
    throw new AppError('FORBIDDEN', 403)
  }

  await db.query(`UPDATE barbers SET is_active = false WHERE id = $1`, [barberId])
}
