import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { listCatalog, listBarberServices, addBarberService, updateBarberService, deleteBarberService } from '../services/catalog'
import { requireAuth } from '../lib/require-auth'

const addServiceSchema = z.object({
  name: z.string().min(1),
  duration_minutes: z.number().int().positive(),
  price: z.number().positive().optional(),
  service_catalog_id: z.string().uuid().optional(),
})

const updateServiceSchema = z.object({
  name: z.string().min(1).optional(),
  duration_minutes: z.number().int().positive().optional(),
  price: z.number().positive().optional(),
})

export async function serviceRoutes(app: FastifyInstance) {
  app.get('/service-catalog', async (_req, reply) => {
    return reply.send(await listCatalog())
  })

  app.get<{ Params: { id: string } }>('/barbers/:id/services', async (req, reply) => {
    return reply.send(await listBarberServices(req.params.id))
  })

  app.post<{ Params: { id: string } }>('/barbers/:id/services', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = addServiceSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(422).send({ code: 'VALIDATION_ERROR', errors: parsed.error.flatten() })
    const result = await addBarberService(req.params.id, req.user!, parsed.data)
    return reply.code(201).send(result)
  })

  app.patch<{ Params: { id: string; serviceId: string } }>('/barbers/:id/services/:serviceId', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = updateServiceSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(422).send({ code: 'VALIDATION_ERROR', errors: parsed.error.flatten() })
    await updateBarberService(req.params.id, req.params.serviceId, req.user!, parsed.data)
    return reply.code(204).send()
  })

  app.delete<{ Params: { id: string; serviceId: string } }>('/barbers/:id/services/:serviceId', { preHandler: requireAuth }, async (req, reply) => {
    await deleteBarberService(req.params.id, req.params.serviceId, req.user!)
    return reply.code(204).send()
  })
}
