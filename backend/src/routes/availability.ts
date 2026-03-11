import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getSchedule, upsertSchedule, getExceptions, addException, deleteException, getAvailableSlots } from '../services/availability'
import { requireAuth } from '../lib/require-auth'

const scheduleDaySchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  is_working: z.boolean(),
})

const upsertScheduleSchema = z.object({
  days: z.array(scheduleDaySchema).length(7),
})

const addExceptionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  is_off: z.boolean(),
  start_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  end_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  reason: z.string().optional(),
})

export async function availabilityRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>('/barbers/:id/schedule', async (req, reply) => {
    return reply.send(await getSchedule(req.params.id))
  })

  app.put<{ Params: { id: string } }>('/barbers/:id/schedule', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = upsertScheduleSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(422).send({ code: 'VALIDATION_ERROR', errors: parsed.error.flatten() })
    await upsertSchedule(req.params.id, req.user!, parsed.data.days)
    return reply.code(204).send()
  })

  app.get<{ Params: { id: string }; Querystring: { from?: string; to?: string } }>('/barbers/:id/exceptions', async (req, reply) => {
    const { from, to } = req.query
    return reply.send(await getExceptions(req.params.id, from, to))
  })

  app.post<{ Params: { id: string } }>('/barbers/:id/exceptions', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = addExceptionSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(422).send({ code: 'VALIDATION_ERROR', errors: parsed.error.flatten() })
    await addException(req.params.id, req.user!, parsed.data)
    return reply.code(201).send()
  })

  app.delete<{ Params: { id: string; date: string } }>('/barbers/:id/exceptions/:date', { preHandler: requireAuth }, async (req, reply) => {
    await deleteException(req.params.id, req.params.date, req.user!)
    return reply.code(204).send()
  })

  app.get<{ Params: { id: string }; Querystring: { date?: string; serviceId?: string } }>(
    '/barbers/:id/slots',
    async (req, reply) => {
      const { date, serviceId } = req.query
      if (!date || !serviceId) {
        return reply.code(422).send({ code: 'VALIDATION_ERROR', message: 'date and serviceId are required' })
      }
      const slots = await getAvailableSlots(req.params.id, date, serviceId)
      return reply.send({ slots })
    }
  )
}
