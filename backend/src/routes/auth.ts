import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { registerOwner } from '../services/auth'
import { login } from '../services/auth'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  shopName: z.string().min(2),
  shopCity: z.string().min(2),
  ownerName: z.string().min(2),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(422).send({ code: 'VALIDATION_ERROR', errors: parsed.error.flatten() })
    }
    const result = await registerOwner(parsed.data)
    return reply.code(201).send(result)
  })

  app.post('/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(422).send({ code: 'VALIDATION_ERROR', errors: parsed.error.flatten() })
    }
    const result = await login(parsed.data.email, parsed.data.password)
    return reply.send(result)
  })
}
