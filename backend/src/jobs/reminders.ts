import { db } from '../db/pool'

function getTwilioClient() {
  const twilio = require('twilio')
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
}

async function sendReminders() {
  const res = await db.query(
    `SELECT a.id, a.start_time,
            b.name AS barber_name,
            bs.name AS service_name,
            c.phone AS customer_phone
     FROM appointments a
     JOIN barbers b ON b.id = a.barber_id
     JOIN barber_services bs ON bs.id = a.barber_service_id
     JOIN customers c ON c.id = a.customer_id
     WHERE a.status = 'confirmed'
       AND a.reminder_sent = false
       AND a.start_time BETWEEN now() + interval '55 minutes' AND now() + interval '65 minutes'`
  )

  if (res.rows.length === 0) return

  console.log(`[reminders] ${res.rows.length} reminders to send`)

  for (const row of res.rows) {
    const time = new Date(row.start_time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    const message = `Promemoria Barbit: hai un appuntamento alle ${time} con ${row.barber_name} (${row.service_name}).`

    try {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[reminder] ${row.customer_phone} → ${message}`)
      } else {
        const client = getTwilioClient()
        await client.messages.create({
          body: message,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: row.customer_phone,
        })
      }

      await db.query(
        `UPDATE appointments SET reminder_sent = true WHERE id = $1`,
        [row.id]
      )
    } catch (err) {
      console.error(`[reminder] failed for appointment ${row.id}:`, err)
    }
  }
}

export function startReminderJob() {
  const INTERVAL_MS = 5 * 60 * 1000
  console.log('[reminders] job started (every 5 minutes)')
  setInterval(() => {
    sendReminders().catch(err => console.error('[reminders] error:', err))
  }, INTERVAL_MS)
}
