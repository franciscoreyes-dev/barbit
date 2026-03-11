import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  createAppointment,
  getCustomerAppointments,
  cancelAppointment,
  getBarberAppointments,
  getShopAppointments,
  updateAppointmentStatus,
} from '../services/appointment'
import { requireAuth, requireOwner } from '../lib/require-auth'
import { requireCustomer } from '../lib/require-customer'

const createSchema = z.object({
  barberId: z.string().uuid(),
  serviceId: z.string().uuid(),
  startTime: z.string().datetime(),
})

const updateStatusSchema = z.object({
  status: z.enum(['completed', 'no_show']),
})

export async function appointmentRoutes(app: FastifyInstance) {
  app.post('/appointments', { preHandler: requireCustomer }, async (req, reply) => {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(422).send({ code: 'VALIDATION_ERROR', errors: parsed.error.flatten() })
    const result = await createAppointment(parsed.data, req.customer!)
    return reply.code(201).send(result)
  })

  app.get('/appointments/mine', { preHandler: requireCustomer }, async (req, reply) => {
    return reply.send(await getCustomerAppointments(req.customer!.customerId))
  })

  app.delete<{ Params: { id: string } }>('/appointments/:id', { preHandler: requireCustomer }, async (req, reply) => {
    await cancelAppointment(req.params.id, req.customer!.customerId)
    return reply.code(204).send()
  })

  app.get<{ Params: { id: string }; Querystring: { date?: string } }>(
    '/barbers/:id/appointments',
    { preHandler: requireAuth },
    async (req, reply) => {
      const date = req.query.date
      if (!date) return reply.code(422).send({ code: 'VALIDATION_ERROR', message: 'date is required' })
      return reply.send(await getBarberAppointments(req.params.id, date, req.user!))
    }
  )

  app.get<{ Params: { id: string }; Querystring: { date?: string } }>(
    '/shops/:id/appointments',
    { preHandler: requireOwner },
    async (req, reply) => {
      const date = req.query.date
      if (!date) return reply.code(422).send({ code: 'VALIDATION_ERROR', message: 'date is required' })
      return reply.send(await getShopAppointments(req.params.id, date, req.user!))
    }
  )

  app.patch<{ Params: { id: string } }>(
    '/appointments/:id/status',
    { preHandler: requireAuth },
    async (req, reply) => {
      const parsed = updateStatusSchema.safeParse(req.body)
      if (!parsed.success) return reply.code(422).send({ code: 'VALIDATION_ERROR', errors: parsed.error.flatten() })
      await updateAppointmentStatus(req.params.id, parsed.data.status, req.user!)
      return reply.code(204).send()
    }
  )
}
