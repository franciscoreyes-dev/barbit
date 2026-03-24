import 'dotenv/config'
import bcrypt from 'bcrypt'
import { db } from './pool'

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

async function seed() {
  // Service catalog (idempotent)
  const catalog = [
    { name: 'Taglio', duration: 30, category: 'hair' },
    { name: 'Barba', duration: 20, category: 'beard' },
    { name: 'Taglio + Barba', duration: 45, category: 'combo' },
    { name: 'Taglio Bambino', duration: 20, category: 'kids' },
  ]
  for (const svc of catalog) {
    await db.query(
      `INSERT INTO service_catalog (name, default_duration_minutes, category)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [svc.name, svc.duration, svc.category]
    )
  }
  console.log('service_catalog seeded')

  // Wipe existing test data so script is re-runnable
  await db.query(`DELETE FROM shops WHERE slug = 'barberia-milano'`)

  // Shop
  const { rows: [shop] } = await db.query<{ id: string }>(
    `INSERT INTO shops (name, slug, city, address, phone, email, timezone)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    ['Barberia Milano', 'barberia-milano', 'Milano', 'Via Torino 42', '+39 02 1234567', 'info@barberiamilano.it', 'Europe/Rome']
  )
  console.log(`shop: ${shop.id}`)

  // Owner user
  const ownerHash = await bcrypt.hash('password123', 12)
  const { rows: [owner] } = await db.query<{ id: string }>(
    `INSERT INTO users (email, password_hash, role, shop_id, is_active)
     VALUES ($1, $2, 'owner', $3, true) RETURNING id`,
    ['owner@test.com', ownerHash, shop.id]
  )
  console.log(`owner: ${owner.id}`)

  // Owner barber profile
  const { rows: [ownerBarber] } = await db.query<{ id: string }>(
    `INSERT INTO barbers (user_id, shop_id, name) VALUES ($1, $2, $3) RETURNING id`,
    [owner.id, shop.id, 'Giuseppe Verdi']
  )

  // Barbers
  const barberDefs = [
    { email: 'marco@test.com', name: 'Marco Rossi' },
    { email: 'luca@test.com', name: 'Luca Bianchi' },
  ]

  const allBarberIds: string[] = [ownerBarber.id]

  for (const def of barberDefs) {
    const hash = await bcrypt.hash('password123', 12)
    const { rows: [user] } = await db.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role, shop_id, is_active)
       VALUES ($1, $2, 'barber', $3, true) RETURNING id`,
      [def.email, hash, shop.id]
    )
    const { rows: [barber] } = await db.query<{ id: string }>(
      `INSERT INTO barbers (user_id, shop_id, name) VALUES ($1, $2, $3) RETURNING id`,
      [user.id, shop.id, def.name]
    )
    allBarberIds.push(barber.id)
    console.log(`barber: ${def.name} (${barber.id})`)
  }

  // Services for ALL barbers (including owner)
  const services = [
    { name: 'Taglio', duration_minutes: 30, price: '15.00' },
    { name: 'Barba', duration_minutes: 20, price: '10.00' },
    { name: 'Taglio + Barba', duration_minutes: 45, price: '22.00' },
  ]

  const barberServiceIds: Record<string, string[]> = {}

  for (const barberId of allBarberIds) {
    barberServiceIds[barberId] = []
    for (const svc of services) {
      const { rows: [inserted] } = await db.query<{ id: string }>(
        `INSERT INTO barber_services (barber_id, name, duration_minutes, price)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [barberId, svc.name, svc.duration_minutes, svc.price]
      )
      barberServiceIds[barberId].push(inserted.id)
    }
  }
  console.log('barber_services seeded')

  // Weekly schedule: Mon–Sat 09:00–18:00, Sun off — for ALL barbers
  for (const barberId of allBarberIds) {
    for (let day = 0; day <= 6; day++) {
      const isWorking = day >= 1 && day <= 6
      await db.query(
        `INSERT INTO weekly_schedule (barber_id, day_of_week, start_time, end_time, is_working)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (barber_id, day_of_week) DO UPDATE
           SET start_time = EXCLUDED.start_time,
               end_time = EXCLUDED.end_time,
               is_working = EXCLUDED.is_working`,
        [barberId, day, '09:00', '18:00', isWorking]
      )
    }
  }
  console.log('weekly_schedule seeded')

  // Fake customers
  const customerNames = [
    'Andrea Conti', 'Matteo Ricci', 'Davide Moretti', 'Federico Romano',
    'Simone Ferrari', 'Alessio Russo', 'Lorenzo Colombo', 'Giacomo Galli',
    'Filippo Martini', 'Tommaso Bruno', 'Pietro Villa', 'Stefano Costa',
  ]
  const customerIds: string[] = []
  for (let i = 0; i < customerNames.length; i++) {
    const phone = `+3933300${String(10000 + i)}`
    const { rows: [customer] } = await db.query<{ id: string }>(
      `INSERT INTO customers (phone, name, shop_id) VALUES ($1, $2, $3)
       ON CONFLICT (phone, shop_id) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [phone, customerNames[i], shop.id]
    )
    customerIds.push(customer.id)
  }
  console.log(`${customerIds.length} customers seeded`)

  // Fake appointments: spread across this week and next week
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const monday = addDays(today, -(today.getDay() === 0 ? 6 : today.getDay() - 1))

  const timeSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00']

  let appointmentCount = 0

  for (let weekOffset = 0; weekOffset < 2; weekOffset++) {
    for (let dayOffset = 0; dayOffset < 6; dayOffset++) {
      const date = addDays(monday, weekOffset * 7 + dayOffset)
      const dateStr = toDateStr(date)

      for (const barberId of allBarberIds) {
        const svcIds = barberServiceIds[barberId]
        const numAppointments = 3 + Math.floor(Math.random() * 5)
        const usedSlots = new Set<string>()

        for (let a = 0; a < numAppointments && usedSlots.size < timeSlots.length; a++) {
          let slot: string
          do {
            slot = randomItem(timeSlots)
          } while (usedSlots.has(slot))
          usedSlots.add(slot)

          const serviceId = randomItem(svcIds)
          const customerId = randomItem(customerIds)

          const svcRes = await db.query<{ duration_minutes: number }>(
            `SELECT duration_minutes FROM barber_services WHERE id = $1`,
            [serviceId]
          )
          const duration = svcRes.rows[0].duration_minutes

          const startTime = new Date(`${dateStr}T${slot}:00Z`)
          const endTime = new Date(startTime.getTime() + duration * 60 * 1000)

          const isPast = startTime < now
          const status = isPast
            ? (Math.random() < 0.8 ? 'completed' : 'no_show')
            : 'confirmed'

          try {
            await db.query(
              `INSERT INTO appointments (shop_id, barber_id, customer_id, barber_service_id, start_time, end_time, status)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [shop.id, barberId, customerId, serviceId, startTime.toISOString(), endTime.toISOString(), status]
            )
            appointmentCount++
          } catch {
            // skip conflicts
          }
        }
      }
    }
  }
  console.log(`${appointmentCount} appointments seeded`)

  await db.end()
  console.log('\nseed complete')
  console.log('  shop slug : barberia-milano')
  console.log('  owner     : owner@test.com / password123 (barber: Giuseppe Verdi)')
  console.log('  barber 1  : marco@test.com / password123')
  console.log('  barber 2  : luca@test.com  / password123')
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
