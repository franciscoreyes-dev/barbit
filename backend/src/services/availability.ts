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

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export async function getAvailableSlots(
  barberId: string,
  date: string,
  serviceId: string
): Promise<string[]> {
  const svcRes = await db.query(
    `SELECT duration_minutes FROM barber_services WHERE id = $1 AND barber_id = $2 AND is_active = true`,
    [serviceId, barberId]
  )
  const service = svcRes.rows[0]
  if (!service) throw new AppError('SERVICE_NOT_FOUND', 404)
  const duration: number = service.duration_minutes

  const dayOfWeek = new Date(date + 'T00:00:00Z').getUTCDay()

  const schedRes = await db.query(
    `SELECT start_time, end_time, is_working FROM weekly_schedule WHERE barber_id = $1 AND day_of_week = $2`,
    [barberId, dayOfWeek]
  )
  const schedule = schedRes.rows[0]
  if (!schedule || !schedule.is_working) return []

  const excRes = await db.query(
    `SELECT is_off, start_time, end_time FROM schedule_exceptions WHERE barber_id = $1 AND date = $2`,
    [barberId, date]
  )
  const exception = excRes.rows[0] ?? null
  if (exception?.is_off) return []

  const startMin = timeToMinutes(exception?.start_time ?? schedule.start_time)
  const endMin = timeToMinutes(exception?.end_time ?? schedule.end_time)

  const apptRes = await db.query(
    `SELECT start_time, end_time FROM appointments
     WHERE barber_id = $1 AND status != 'cancelled'
     AND DATE(start_time AT TIME ZONE 'UTC') = $2::date`,
    [barberId, date]
  )

  const slots: string[] = []
  let current = startMin
  while (current + duration <= endMin) {
    const slotStart = new Date(
      `${date}T${String(Math.floor(current / 60)).padStart(2, '0')}:${String(current % 60).padStart(2, '0')}:00Z`
    )
    const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000)

    const overlaps = apptRes.rows.some(
      (appt) => slotStart < new Date(appt.end_time) && slotEnd > new Date(appt.start_time)
    )
    if (!overlaps) slots.push(slotStart.toISOString())
    current += duration
  }
  return slots
}
