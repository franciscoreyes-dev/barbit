import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/services/barber', () => ({
  listBarbers: vi.fn(),
  updateBarber: vi.fn(),
  deactivateBarber: vi.fn(),
}))

vi.mock('../../src/lib/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async (req: any) => {
    req.user = { userId: 'user-1', role: 'owner', shopId: 'shop-1' }
  }),
  requireOwner: vi.fn().mockImplementation(async (req: any) => {
    req.user = { userId: 'user-1', role: 'owner', shopId: 'shop-1' }
  }),
}))

import { listBarbers, updateBarber, deactivateBarber } from '../../src/services/barber'
import { requireAuth, requireOwner } from '../../src/lib/require-auth'
import { AppError } from '../../src/lib/errors'
import Fastify from 'fastify'
import { barberRoutes } from '../../src/routes/barbers'

function buildTestApp() {
  const app = Fastify({ logger: false })
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof AppError) reply.code(error.statusCode).send({ code: error.code })
    else reply.code(500).send({ code: 'INTERNAL_SERVER_ERROR' })
  })
  app.register(barberRoutes)
  return app
}

const app = buildTestApp()

describe('GET /shops/:shopId/barbers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with barbers array', async () => {
    const barbers = [
      { id: 'barber-1', name: 'Mario', avatar_url: null, services: [] },
      { id: 'barber-2', name: 'Luigi', avatar_url: null, services: [{ id: 'svc-1', name: 'Taglio', duration_minutes: 30, price: '15.00' }] },
    ]
    vi.mocked(listBarbers).mockResolvedValue(barbers)

    const res = await app.inject({ method: 'GET', url: '/shops/shop-1/barbers' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual(barbers)
    expect(listBarbers).toHaveBeenCalledWith('shop-1')
  })

  it('does NOT call requireAuth (public endpoint)', async () => {
    vi.mocked(listBarbers).mockResolvedValue([])

    await app.inject({ method: 'GET', url: '/shops/shop-1/barbers' })

    expect(vi.mocked(requireAuth)).not.toHaveBeenCalled()
  })

  it('returns 200 with empty array when no barbers', async () => {
    vi.mocked(listBarbers).mockResolvedValue([])

    const res = await app.inject({ method: 'GET', url: '/shops/shop-1/barbers' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual([])
  })
})

describe('PATCH /barbers/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 204 on success', async () => {
    vi.mocked(updateBarber).mockResolvedValue(undefined)

    const res = await app.inject({
      method: 'PATCH',
      url: '/barbers/barber-1',
      payload: { name: 'Mario Updated' },
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(204)
    expect(updateBarber).toHaveBeenCalledWith(
      'barber-1',
      expect.objectContaining({ role: 'owner' }),
      { name: 'Mario Updated' }
    )
  })

  it('calls requireAuth preHandler', async () => {
    vi.mocked(updateBarber).mockResolvedValue(undefined)

    await app.inject({
      method: 'PATCH',
      url: '/barbers/barber-1',
      payload: { name: 'Mario Updated' },
      headers: { authorization: 'Bearer token' },
    })

    expect(vi.mocked(requireAuth)).toHaveBeenCalled()
  })

  it('returns 404 when updateBarber throws BARBER_NOT_FOUND', async () => {
    vi.mocked(updateBarber).mockRejectedValue(new AppError('BARBER_NOT_FOUND', 404))

    const res = await app.inject({
      method: 'PATCH',
      url: '/barbers/barber-1',
      payload: { name: 'Mario' },
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'BARBER_NOT_FOUND' })
  })

  it('returns 403 when updateBarber throws FORBIDDEN', async () => {
    vi.mocked(updateBarber).mockRejectedValue(new AppError('FORBIDDEN', 403))

    const res = await app.inject({
      method: 'PATCH',
      url: '/barbers/barber-1',
      payload: { name: 'Mario' },
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'FORBIDDEN' })
  })

  it('returns 422 when name is empty string', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/barbers/barber-1',
      payload: { name: '' },
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(422)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('returns 422 when avatar_url is not a valid URL', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/barbers/barber-1',
      payload: { avatar_url: 'not-a-url' },
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(422)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'VALIDATION_ERROR' })
  })
})

describe('DELETE /barbers/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 204 on success', async () => {
    vi.mocked(deactivateBarber).mockResolvedValue(undefined)

    const res = await app.inject({
      method: 'DELETE',
      url: '/barbers/barber-1',
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(204)
    expect(deactivateBarber).toHaveBeenCalledWith(
      'barber-1',
      expect.objectContaining({ role: 'owner' })
    )
  })

  it('calls requireOwner preHandler', async () => {
    vi.mocked(deactivateBarber).mockResolvedValue(undefined)

    await app.inject({
      method: 'DELETE',
      url: '/barbers/barber-1',
      headers: { authorization: 'Bearer token' },
    })

    expect(vi.mocked(requireOwner)).toHaveBeenCalled()
  })

  it('returns 404 when deactivateBarber throws BARBER_NOT_FOUND', async () => {
    vi.mocked(deactivateBarber).mockRejectedValue(new AppError('BARBER_NOT_FOUND', 404))

    const res = await app.inject({
      method: 'DELETE',
      url: '/barbers/barber-1',
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'BARBER_NOT_FOUND' })
  })

  it('returns 403 when deactivateBarber throws FORBIDDEN', async () => {
    vi.mocked(deactivateBarber).mockRejectedValue(new AppError('FORBIDDEN', 403))

    const res = await app.inject({
      method: 'DELETE',
      url: '/barbers/barber-1',
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'FORBIDDEN' })
  })
})
