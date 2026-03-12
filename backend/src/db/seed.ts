import 'dotenv/config'
import bcrypt from 'bcrypt'
import { db } from './pool'

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
    `INSERT INTO shops (name, slug, city, timezone)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    ['Barberia Milano', 'barberia-milano', 'Milano', 'Europe/Rome']
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

  // Owner barber profile (required by registration flow)
  await db.query(
    `INSERT INTO barbers (user_id, shop_id, name) VALUES ($1, $2, $3)`,
    [owner.id, shop.id, 'Owner']
  )

  // Barbers
  const barberDefs = [
    { email: 'marco@test.com', name: 'Marco Rossi' },
    { email: 'luca@test.com', name: 'Luca Bianchi' },
  ]

  const barberIds: string[] = []

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
    barberIds.push(barber.id)
    console.log(`barber: ${def.name} (${barber.id})`)
  }

  // Services for each barber
  const services = [
    { name: 'Taglio', duration_minutes: 30, price: '15.00' },
    { name: 'Barba', duration_minutes: 20, price: '10.00' },
    { name: 'Taglio + Barba', duration_minutes: 45, price: '22.00' },
  ]

  for (const barberId of barberIds) {
    for (const svc of services) {
      await db.query(
        `INSERT INTO barber_services (barber_id, name, duration_minutes, price)
         VALUES ($1, $2, $3, $4)`,
        [barberId, svc.name, svc.duration_minutes, svc.price]
      )
    }
  }
  console.log('barber_services seeded')

  // Weekly schedule: Mon–Sat 09:00–18:00, Sun off
  for (const barberId of barberIds) {
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

  await db.end()
  console.log('\nseed complete')
  console.log('  shop slug : barberia-milano')
  console.log('  owner     : owner@test.com / password123')
  console.log('  barber 1  : marco@test.com / password123')
  console.log('  barber 2  : luca@test.com  / password123')
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
