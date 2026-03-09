import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { registerOwner, login } from '../services/auth'
import { sendOtp, verifyOtp } from '../services/otp'

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

const otpSendSchema = z.object({
  phone: z.string().min(10),
  shopId: z.string().uuid(),
})

const otpVerifySchema = z.object({
  phone: z.string().min(10),
  code: z.string().length(6),
  shopId: z.string().uuid(),
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

  app.post('/otp/send', async (req, reply) => {
    const parsed = otpSendSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(422).send({ code: 'VALIDATION_ERROR', errors: parsed.error.flatten() })
    }
    await sendOtp(parsed.data.phone)
    return reply.send({ ok: true })
  })

  app.post('/otp/verify', async (req, reply) => {
    const parsed = otpVerifySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(422).send({ code: 'VALIDATION_ERROR', errors: parsed.error.flatten() })
    }
    const result = await verifyOtp(parsed.data.phone, parsed.data.code, parsed.data.shopId)
    return reply.send(result)
  })
}
