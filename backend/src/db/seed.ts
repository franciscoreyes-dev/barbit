import { db } from './pool'

async function seed() {
  const services = [
    { name: 'Taglio', duration: 30, category: 'hair' },
    { name: 'Barba', duration: 20, category: 'beard' },
    { name: 'Taglio + Barba', duration: 45, category: 'combo' },
    { name: 'Taglio Bambino', duration: 20, category: 'kids' },
  ]

  for (const svc of services) {
    await db.query(
      `INSERT INTO service_catalog (name, default_duration_minutes, category)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [svc.name, svc.duration, svc.category]
    )
    console.log(`seeded: ${svc.name}`)
  }

  await db.end()
  console.log('seed complete')
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
