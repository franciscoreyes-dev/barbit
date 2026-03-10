import Fastify from 'fastify'
import { authRoutes } from './routes/auth'
import { inviteRoutes } from './routes/invite'
import { shopRoutes } from './routes/shops'
import { barberRoutes } from './routes/barbers'
import { AppError } from './lib/errors'

export function buildApp() {
  const app = Fastify({ logger: false })

  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof AppError) {
      reply.code(error.statusCode).send({ code: error.code })
    } else {
      reply.code(500).send({ code: 'INTERNAL_SERVER_ERROR' })
    }
  })

  app.get('/health', async () => ({ status: 'ok' }))
  app.register(authRoutes, { prefix: '/auth' })
  app.register(inviteRoutes)
  app.register(shopRoutes)
  app.register(barberRoutes)

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
  })
}
