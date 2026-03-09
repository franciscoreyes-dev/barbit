import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { sendInvite, getInviteInfo, acceptInvite } from '../services/invite'
import { requireOwner } from '../lib/require-auth'

const acceptSchema = z.object({
  name: z.string().min(2),
  password: z.string().min(8),
})

const sendInviteSchema = z.object({
  email: z.string().email(),
})

export async function inviteRoutes(app: FastifyInstance) {
  app.get<{ Params: { token: string } }>('/invite/:token', async (req, reply) => {
    const result = await getInviteInfo(req.params.token)
    return reply.send(result)
  })

  app.post<{ Params: { token: string } }>('/invite/:token/accept', async (req, reply) => {
    const parsed = acceptSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(422).send({ code: 'VALIDATION_ERROR', errors: parsed.error.flatten() })
    }
    const result = await acceptInvite(req.params.token, parsed.data.name, parsed.data.password)
    return reply.code(201).send(result)
  })

  app.post('/barbers/invite', { preHandler: requireOwner }, async (req, reply) => {
    const parsed = sendInviteSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(422).send({ code: 'VALIDATION_ERROR', errors: parsed.error.flatten() })
    }
    await sendInvite(parsed.data.email, req.user!.shopId)
    return reply.send({ ok: true })
  })
}
