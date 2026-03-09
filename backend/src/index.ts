import Fastify from 'fastify'
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
