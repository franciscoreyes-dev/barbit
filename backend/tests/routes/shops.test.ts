import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/services/shop', () => ({
  searchShops: vi.fn(),
  getShopBySlug: vi.fn(),
  updateShop: vi.fn(),
}))

vi.mock('../../src/lib/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async (req: any) => {
    req.user = { userId: 'user-1', role: 'owner', shopId: 'shop-1' }
  }),
  requireOwner: vi.fn().mockImplementation(async (req: any) => {
    req.user = { userId: 'user-1', role: 'owner', shopId: 'shop-1' }
  }),
}))

import { searchShops, getShopBySlug, updateShop } from '../../src/services/shop'
import { requireOwner } from '../../src/lib/require-auth'
import { AppError } from '../../src/lib/errors'
import Fastify from 'fastify'
import { shopRoutes } from '../../src/routes/shops'

function buildTestApp() {
  const app = Fastify({ logger: false })
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof AppError) reply.code(error.statusCode).send({ code: error.code })
    else reply.code(500).send({ code: 'INTERNAL_SERVER_ERROR' })
  })
  app.register(shopRoutes)
  return app
}

const app = buildTestApp()

describe('GET /shops/search', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with array when searching by q', async () => {
    const shops = [{ id: 'shop-1', name: 'Test Shop', slug: 'test-shop', city: 'Roma', address: null }]
    vi.mocked(searchShops).mockResolvedValue(shops)

    const res = await app.inject({ method: 'GET', url: '/shops/search?q=Test' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual(shops)
    expect(searchShops).toHaveBeenCalledWith('Test', undefined)
  })

  it('returns 200 with array when no params', async () => {
    const shops = [
      { id: 'shop-1', name: 'Alpha', slug: 'alpha', city: 'Roma', address: null },
      { id: 'shop-2', name: 'Beta', slug: 'beta', city: 'Milano', address: null },
    ]
    vi.mocked(searchShops).mockResolvedValue(shops)

    const res = await app.inject({ method: 'GET', url: '/shops/search' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toHaveLength(2)
    expect(searchShops).toHaveBeenCalledWith(undefined, undefined)
  })

  it('passes city param to searchShops', async () => {
    vi.mocked(searchShops).mockResolvedValue([])

    const res = await app.inject({ method: 'GET', url: '/shops/search?city=Roma' })
    expect(res.statusCode).toBe(200)
    expect(searchShops).toHaveBeenCalledWith(undefined, 'Roma')
  })
})

describe('GET /shops/:slug', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with shop profile', async () => {
    const profile = {
      id: 'shop-1', name: 'Barberino', slug: 'barberino', city: 'Roma',
      address: null, phone: null, email: null, timezone: 'Europe/Rome',
      barbers: [],
    }
    vi.mocked(getShopBySlug).mockResolvedValue(profile)

    const res = await app.inject({ method: 'GET', url: '/shops/barberino' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toMatchObject({ slug: 'barberino' })
    expect(getShopBySlug).toHaveBeenCalledWith('barberino')
  })

  it('returns 404 when getShopBySlug throws SHOP_NOT_FOUND', async () => {
    vi.mocked(getShopBySlug).mockRejectedValue(new AppError('SHOP_NOT_FOUND', 404))

    const res = await app.inject({ method: 'GET', url: '/shops/not-found' })
    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'SHOP_NOT_FOUND' })
  })
})

describe('PATCH /shops/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 204 on success', async () => {
    vi.mocked(updateShop).mockResolvedValue(undefined)

    const res = await app.inject({
      method: 'PATCH',
      url: '/shops/shop-1',
      payload: { name: 'New Name' },
      headers: { authorization: 'Bearer owner-token' },
    })
    expect(res.statusCode).toBe(204)
    expect(updateShop).toHaveBeenCalledWith('shop-1', expect.objectContaining({ role: 'owner' }), { name: 'New Name' })
  })

  it('calls requireOwner preHandler', async () => {
    vi.mocked(updateShop).mockResolvedValue(undefined)

    await app.inject({
      method: 'PATCH',
      url: '/shops/shop-1',
      payload: { city: 'Milano' },
      headers: { authorization: 'Bearer owner-token' },
    })

    expect(vi.mocked(requireOwner)).toHaveBeenCalled()
  })

  it('returns 422 on invalid email', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/shops/shop-1',
      payload: { email: 'not-an-email' },
      headers: { authorization: 'Bearer owner-token' },
    })
    expect(res.statusCode).toBe(422)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('returns 409 when updateShop throws SLUG_TAKEN', async () => {
    vi.mocked(updateShop).mockRejectedValue(new AppError('SLUG_TAKEN', 409))

    const res = await app.inject({
      method: 'PATCH',
      url: '/shops/shop-1',
      payload: { name: 'Existing Name' },
      headers: { authorization: 'Bearer owner-token' },
    })
    expect(res.statusCode).toBe(409)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'SLUG_TAKEN' })
  })

  it('returns 403 when updateShop throws FORBIDDEN', async () => {
    vi.mocked(updateShop).mockRejectedValue(new AppError('FORBIDDEN', 403))

    const res = await app.inject({
      method: 'PATCH',
      url: '/shops/shop-1',
      payload: { city: 'Roma' },
      headers: { authorization: 'Bearer owner-token' },
    })
    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'FORBIDDEN' })
  })
})
