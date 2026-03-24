import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { searchShops, getShopBySlug, updateShop, getShopById, getShopStats } from '../services/shop'
import { requireOwner } from '../lib/require-auth'
import { OwnerBarberPayload } from '../lib/jwt'

const updateShopSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  email: z.string().email().optional(),
  timezone: z.string().min(1).optional(),
})

export async function shopRoutes(app: FastifyInstance) {
  app.get('/shops/mine', { preHandler: requireOwner }, async (req, reply) => {
    const user = req.user as OwnerBarberPayload
    const shop = await getShopById(user.shopId)
    reply.send(shop)
  })

  app.get('/shops/search', async (req, reply) => {
    const { q, city } = req.query as { q?: string; city?: string }
    const results = await searchShops(q, city)
    return reply.send(results)
  })

  app.get<{ Params: { slug: string } }>('/shops/:slug', async (req, reply) => {
    const result = await getShopBySlug(req.params.slug)
    return reply.send(result)
  })

  app.get<{ Params: { id: string }; Querystring: { from?: string; to?: string; barberIds?: string } }>(
    '/shops/:id/stats',
    { preHandler: requireOwner },
    async (req, reply) => {
      const { from, to, barberIds } = req.query
      if (!from || !to) return reply.code(422).send({ code: 'VALIDATION_ERROR', message: 'from and to are required' })
      const barberIdList = barberIds ? barberIds.split(',').filter(Boolean) : undefined
      const stats = await getShopStats(req.params.id, from, to, req.user!, barberIdList)
      return reply.send(stats)
    }
  )

  app.patch<{ Params: { id: string } }>('/shops/:id', { preHandler: requireOwner }, async (req, reply) => {
    const parsed = updateShopSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(422).send({ code: 'VALIDATION_ERROR', errors: parsed.error.flatten() })
    }
    await updateShop(req.params.id, req.user!, parsed.data)
    return reply.code(204).send()
  })
}
