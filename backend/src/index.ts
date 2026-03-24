import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { authRoutes } from './routes/auth'
import { inviteRoutes } from './routes/invite'
import { shopRoutes } from './routes/shops'
import { barberRoutes } from './routes/barbers'
import { serviceRoutes } from './routes/services'
import { availabilityRoutes } from './routes/availability'
import { appointmentRoutes } from './routes/appointments'
import { AppError } from './lib/errors'
import { startReminderJob } from './jobs/reminders'

export function buildApp() {
  const app = Fastify({ logger: false })

  app.register(cors, {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })

  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof AppError) {
      reply.code(error.statusCode).send({ code: error.code })
    } else {
      console.error(error)
      reply.code(500).send({ code: 'INTERNAL_SERVER_ERROR' })
    }
  })

  app.get('/health', async () => ({ status: 'ok' }))
  app.register(authRoutes, { prefix: '/auth' })
  app.register(inviteRoutes)
  app.register(shopRoutes)
  app.register(barberRoutes)
  app.register(serviceRoutes)
  app.register(availabilityRoutes)
  app.register(appointmentRoutes)

  return app
}

if (require.main === module) {
  const app = buildApp()
  const PORT = Number(process.env.PORT) || 3000
  app.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
    if (err) {
      app.log.error(err)
      process.exit(1)
    }
    startReminderJob()
  })
}
