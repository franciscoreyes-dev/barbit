import { db } from '../db/pool'
import { AppError } from '../lib/errors'
import { OwnerBarberPayload } from '../lib/jwt'
import { authorizeBarberAccess } from '../lib/guard'

export interface ScheduleDay {
  day_of_week: number
  start_time: string
  end_time: string
  is_working: boolean
}

export interface ScheduleException {
  date: string
  is_off: boolean
  start_time: string | null
  end_time: string | null
  reason: string | null
}

export interface AddExceptionInput {
  date: string
  is_off: boolean
  start_time?: string
  end_time?: string
  reason?: string
}

async function fetchBarber(barberId: string) {
  const res = await db.query(
    `SELECT id, user_id, shop_id FROM barbers WHERE id = $1`,
    [barberId]
  )
  return res.rows[0] ?? null
}

export async function getSchedule(barberId: string): Promise<ScheduleDay[]> {
  const res = await db.query(
    `SELECT day_of_week, start_time, end_time, is_working FROM weekly_schedule WHERE barber_id = $1 ORDER BY day_of_week`,
    [barberId]
  )
  return res.rows as ScheduleDay[]
}

export async function upsertSchedule(
  barberId: string,
  user: OwnerBarberPayload,
  days: ScheduleDay[]
): Promise<void> {
  const barber = await fetchBarber(barberId)
  if (!barber) throw new AppError('BARBER_NOT_FOUND', 404)

  authorizeBarberAccess(barber, user)

  const client = await db.connect()
  try {
    await client.query('BEGIN')
    await client.query(`DELETE FROM weekly_schedule WHERE barber_id = $1`, [barberId])
    for (const day of days) {
      await client.query(
        `INSERT INTO weekly_schedule (barber_id, day_of_week, start_time, end_time, is_working) VALUES ($1, $2, $3, $4, $5)`,
        [barberId, day.day_of_week, day.start_time, day.end_time, day.is_working]
      )
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export async function getExceptions(
  barberId: string,
  from?: string,
  to?: string
): Promise<ScheduleException[]> {
  const conditions: string[] = ['barber_id = $1']
  const params: unknown[] = [barberId]

  if (from !== undefined) {
    params.push(from)
    conditions.push(`date >= $${params.length}`)
  }
  if (to !== undefined) {
    params.push(to)
    conditions.push(`date <= $${params.length}`)
  }

  const sql = `SELECT date, is_off, start_time, end_time, reason FROM schedule_exceptions WHERE ${conditions.join(' AND ')} ORDER BY date`
  const res = await db.query(sql, params)

  return res.rows.map((row) => ({
    ...row,
    date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date,
  })) as ScheduleException[]
}

export async function addException(
  barberId: string,
  user: OwnerBarberPayload,
  data: AddExceptionInput
): Promise<void> {
  const barber = await fetchBarber(barberId)
  if (!barber) throw new AppError('BARBER_NOT_FOUND', 404)

  authorizeBarberAccess(barber, user)

  await db.query(
    `INSERT INTO schedule_exceptions (barber_id, date, is_off, start_time, end_time, reason)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (barber_id, date) DO UPDATE SET
       is_off = EXCLUDED.is_off,
       start_time = EXCLUDED.start_time,
       end_time = EXCLUDED.end_time,
       reason = EXCLUDED.reason`,
    [barberId, data.date, data.is_off, data.start_time ?? null, data.end_time ?? null, data.reason ?? null]
  )
}

export async function deleteException(
  barberId: string,
  date: string,
  user: OwnerBarberPayload
): Promise<void> {
  const barber = await fetchBarber(barberId)
  if (!barber) throw new AppError('BARBER_NOT_FOUND', 404)

  authorizeBarberAccess(barber, user)

  await db.query(
    `DELETE FROM schedule_exceptions WHERE barber_id = $1 AND date = $2`,
    [barberId, date]
  )
}
