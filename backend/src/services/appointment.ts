import { db } from '../db/pool'
import { AppError } from '../lib/errors'
import { OwnerBarberPayload, CustomerPayload } from '../lib/jwt'
import { authorizeBarberAccess } from '../lib/guard'

export interface CreateAppointmentInput {
  barberId: string
  serviceId: string
  startTime: string
}

function getTwilio() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const twilio = require('twilio')
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
}

export async function createAppointment(
  data: CreateAppointmentInput,
  customer: CustomerPayload
): Promise<{ id: string; start_time: string; end_time: string }> {
  const serviceRes = await db.query(
    `SELECT duration_minutes FROM barber_services WHERE id = $1 AND barber_id = $2 AND is_active = true`,
    [data.serviceId, data.barberId]
  )
  if (serviceRes.rows.length === 0) throw new AppError('SERVICE_NOT_FOUND', 404)

  const duration: number = serviceRes.rows[0].duration_minutes

  const barberRes = await db.query(
    `SELECT shop_id FROM barbers WHERE id = $1`,
    [data.barberId]
  )
  if (barberRes.rows.length === 0) throw new AppError('BARBER_NOT_FOUND', 404)

  const shopId: string = barberRes.rows[0].shop_id

  const startTime = new Date(data.startTime)
  const endTime = new Date(startTime.getTime() + duration * 60 * 1000)

  const client = await db.connect()
  try {
    await client.query('BEGIN')

    const conflict = await client.query(
      `SELECT id FROM appointments
       WHERE barber_id = $1
         AND status != 'cancelled'
         AND tstzrange(start_time, end_time) && tstzrange($2::timestamptz, $3::timestamptz)
       FOR UPDATE`,
      [data.barberId, startTime.toISOString(), endTime.toISOString()]
    )

    if (conflict.rows.length > 0) throw new AppError('SLOT_TAKEN', 409)

    const insertRes = await client.query(
      `INSERT INTO appointments (shop_id, barber_id, customer_id, barber_service_id, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, start_time, end_time`,
      [shopId, data.barberId, customer.customerId, data.serviceId, startTime.toISOString(), endTime.toISOString()]
    )

    await client.query('COMMIT')

    const appt = insertRes.rows[0] as { id: string; start_time: string; end_time: string }

    db.query(
      `SELECT id, phone, name FROM customers WHERE id = $1`,
      [customer.customerId]
    ).then((custRes) => {
      const cust = custRes.rows[0]
      if (cust?.phone) {
        const twilioClient = getTwilio()
        twilioClient.messages
          .create({
            body: `Prenotazione confermata per ${appt.start_time}`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: cust.phone,
          })
          .catch(() => {})
      }
    }).catch(() => {})

    return appt
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export async function getCustomerAppointments(customerId: string): Promise<unknown[]> {
  const res = await db.query(
    `SELECT a.id, a.start_time, a.end_time, a.status,
            b.name AS barber_name,
            bs.name AS service_name, bs.price,
            s.name AS shop_name
     FROM appointments a
     JOIN barbers b ON b.id = a.barber_id
     JOIN barber_services bs ON bs.id = a.barber_service_id
     JOIN shops s ON s.id = a.shop_id
     WHERE a.customer_id = $1
       AND a.status != 'cancelled'
       AND a.start_time >= now()
     ORDER BY a.start_time`,
    [customerId]
  )
  return res.rows
}

export async function cancelAppointment(appointmentId: string, customerId: string): Promise<void> {
  const res = await db.query(
    `SELECT id, customer_id, start_time, status FROM appointments WHERE id = $1`,
    [appointmentId]
  )
  if (res.rows.length === 0) throw new AppError('APPOINTMENT_NOT_FOUND', 404)

  const appt = res.rows[0] as { id: string; customer_id: string; start_time: Date | string; status: string }

  if (appt.customer_id !== customerId) throw new AppError('FORBIDDEN', 403)
  if (appt.status === 'cancelled') throw new AppError('APPOINTMENT_ALREADY_CANCELLED', 409)

  const hours = (new Date(appt.start_time).getTime() - Date.now()) / (1000 * 60 * 60)
  if (hours < 12) throw new AppError('CANCELLATION_TOO_LATE', 409)

  await db.query(`UPDATE appointments SET status = 'cancelled' WHERE id = $1`, [appointmentId])
}

export async function getBarberAppointments(
  barberId: string,
  date: string,
  user: OwnerBarberPayload
): Promise<unknown[]> {
  const barberRes = await db.query(
    `SELECT user_id, shop_id FROM barbers WHERE id = $1`,
    [barberId]
  )
  if (barberRes.rows.length === 0) throw new AppError('BARBER_NOT_FOUND', 404)

  const barber = barberRes.rows[0] as { user_id: string; shop_id: string }
  authorizeBarberAccess(barber, user)

  const res = await db.query(
    `SELECT a.id, a.start_time, a.end_time, a.status,
            c.name AS customer_name, c.phone AS customer_phone,
            bs.name AS service_name, bs.price
     FROM appointments a
     JOIN customers c ON c.id = a.customer_id
     JOIN barber_services bs ON bs.id = a.barber_service_id
     WHERE a.barber_id = $1
       AND DATE(a.start_time AT TIME ZONE 'UTC') = $2::date
       AND a.status != 'cancelled'
     ORDER BY a.start_time`,
    [barberId, date]
  )
  return res.rows
}

export async function getShopAppointments(
  shopId: string,
  date: string,
  user: OwnerBarberPayload
): Promise<unknown[]> {
  if (user.shopId !== shopId) throw new AppError('FORBIDDEN', 403)

  const res = await db.query(
    `SELECT a.id, a.start_time, a.end_time, a.status,
            b.name AS barber_name,
            c.name AS customer_name, c.phone AS customer_phone,
            bs.name AS service_name, bs.price
     FROM appointments a
     JOIN barbers b ON b.id = a.barber_id
     JOIN customers c ON c.id = a.customer_id
     JOIN barber_services bs ON bs.id = a.barber_service_id
     WHERE a.shop_id = $1
       AND DATE(a.start_time AT TIME ZONE 'UTC') = $2::date
       AND a.status != 'cancelled'
     ORDER BY b.name, a.start_time`,
    [shopId, date]
  )
  return res.rows
}

export async function updateAppointmentStatus(
  appointmentId: string,
  status: 'completed' | 'no_show',
  user: OwnerBarberPayload
): Promise<void> {
  const res = await db.query(
    `SELECT a.id, b.user_id AS barber_user_id, b.shop_id
     FROM appointments a
     JOIN barbers b ON b.id = a.barber_id
     WHERE a.id = $1`,
    [appointmentId]
  )
  if (res.rows.length === 0) throw new AppError('APPOINTMENT_NOT_FOUND', 404)

  const appt = res.rows[0] as { id: string; barber_user_id: string; shop_id: string }
  authorizeBarberAccess({ user_id: appt.barber_user_id, shop_id: appt.shop_id }, user)

  await db.query(`UPDATE appointments SET status = $1 WHERE id = $2`, [status, appointmentId])
}
