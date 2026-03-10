import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { listBarbers, updateBarber, deactivateBarber } from '../services/barber'
import { requireAuth, requireOwner } from '../lib/require-auth'

const updateBarberSchema = z.object({
  name: z.string().min(1).optional(),
  avatar_url: z.string().url().optional(),
  is_active: z.boolean().optional(),
})

export async function barberRoutes(app: FastifyInstance) {
  app.get<{ Params: { shopId: string } }>('/shops/:shopId/barbers', async (req, reply) => {
    const barbers = await listBarbers(req.params.shopId)
    return reply.send(barbers)
  })

  app.patch<{ Params: { id: string } }>('/barbers/:id', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = updateBarberSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(422).send({ code: 'VALIDATION_ERROR', errors: parsed.error.flatten() })
    }
    await updateBarber(req.params.id, req.user!, parsed.data)
    return reply.code(204).send()
  })

  app.delete<{ Params: { id: string } }>('/barbers/:id', { preHandler: requireOwner }, async (req, reply) => {
    await deactivateBarber(req.params.id, req.user!)
    return reply.code(204).send()
  })
}
