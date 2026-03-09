import Fastify from 'fastify'
import { authRoutes } from '../../src/routes/auth'
import { AppError } from '../../src/lib/errors'

export function buildTestApp() {
  const app = Fastify({ logger: false })

  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof AppError) {
      reply.code(error.statusCode).send({ code: error.code })
    } else {
      reply.code(500).send({ code: 'INTERNAL_SERVER_ERROR' })
    }
  })

  app.register(authRoutes, { prefix: '/auth' })
  return app
}
