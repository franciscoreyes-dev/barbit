import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/services/catalog', () => ({
  listCatalog: vi.fn(),
  listBarberServices: vi.fn(),
  addBarberService: vi.fn(),
  updateBarberService: vi.fn(),
  deleteBarberService: vi.fn(),
}))

vi.mock('../../src/lib/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async (req: any) => {
    req.user = { userId: 'user-1', role: 'owner', shopId: 'shop-1' }
  }),
  requireOwner: vi.fn().mockImplementation(async (req: any) => {
    req.user = { userId: 'user-1', role: 'owner', shopId: 'shop-1' }
  }),
}))

import { listCatalog, listBarberServices, addBarberService, updateBarberService, deleteBarberService } from '../../src/services/catalog'
import { requireAuth } from '../../src/lib/require-auth'
import { AppError } from '../../src/lib/errors'
import Fastify from 'fastify'
import { serviceRoutes } from '../../src/routes/services'

function buildTestApp() {
  const app = Fastify({ logger: false })
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof AppError) reply.code(error.statusCode).send({ code: error.code })
    else reply.code(500).send({ code: 'INTERNAL_SERVER_ERROR' })
  })
  app.register(serviceRoutes)
  return app
}

const app = buildTestApp()

describe('GET /service-catalog', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with catalog array', async () => {
    const catalog = [
      { id: 'cat-1', name: 'Taglio', default_duration_minutes: 30, category: 'hair' },
      { id: 'cat-2', name: 'Barba', default_duration_minutes: 20, category: 'beard' },
    ]
    vi.mocked(listCatalog).mockResolvedValue(catalog)

    const res = await app.inject({ method: 'GET', url: '/service-catalog' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual(catalog)
    expect(listCatalog).toHaveBeenCalledTimes(1)
  })

  it('does NOT call requireAuth (public endpoint)', async () => {
    vi.mocked(listCatalog).mockResolvedValue([])

    await app.inject({ method: 'GET', url: '/service-catalog' })

    expect(vi.mocked(requireAuth)).not.toHaveBeenCalled()
  })

  it('returns 200 with empty array when catalog is empty', async () => {
    vi.mocked(listCatalog).mockResolvedValue([])

    const res = await app.inject({ method: 'GET', url: '/service-catalog' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual([])
  })
})

describe('GET /barbers/:id/services', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with services array', async () => {
    const services = [
      { id: 'svc-1', barber_id: 'b-1', service_catalog_id: null, name: 'Taglio', duration_minutes: 30, price: '15.00', is_active: true },
    ]
    vi.mocked(listBarberServices).mockResolvedValue(services)

    const res = await app.inject({ method: 'GET', url: '/barbers/b-1/services' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual(services)
    expect(listBarberServices).toHaveBeenCalledWith('b-1')
  })

  it('does NOT call requireAuth (public endpoint)', async () => {
    vi.mocked(listBarberServices).mockResolvedValue([])

    await app.inject({ method: 'GET', url: '/barbers/b-1/services' })

    expect(vi.mocked(requireAuth)).not.toHaveBeenCalled()
  })

  it('returns 200 with empty array when barber has no services', async () => {
    vi.mocked(listBarberServices).mockResolvedValue([])

    const res = await app.inject({ method: 'GET', url: '/barbers/b-1/services' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual([])
  })
})

describe('POST /barbers/:id/services', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 201 with inserted service on success', async () => {
    const inserted = { id: 'svc-new', barber_id: 'b-1', service_catalog_id: null, name: 'Taglio', duration_minutes: 30, price: null, is_active: true }
    vi.mocked(addBarberService).mockResolvedValue(inserted)

    const res = await app.inject({
      method: 'POST',
      url: '/barbers/b-1/services',
      payload: { name: 'Taglio', duration_minutes: 30 },
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.body)).toEqual(inserted)
    expect(addBarberService).toHaveBeenCalledWith(
      'b-1',
      expect.objectContaining({ role: 'owner' }),
      { name: 'Taglio', duration_minutes: 30 }
    )
  })

  it('calls requireAuth preHandler', async () => {
    vi.mocked(addBarberService).mockResolvedValue({} as any)

    await app.inject({
      method: 'POST',
      url: '/barbers/b-1/services',
      payload: { name: 'Taglio', duration_minutes: 30 },
      headers: { authorization: 'Bearer token' },
    })

    expect(vi.mocked(requireAuth)).toHaveBeenCalled()
  })

  it('returns 422 when name is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/barbers/b-1/services',
      payload: { duration_minutes: 30 },
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(422)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('returns 422 when duration_minutes is negative', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/barbers/b-1/services',
      payload: { name: 'Taglio', duration_minutes: -1 },
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(422)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('returns 422 when duration_minutes is zero', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/barbers/b-1/services',
      payload: { name: 'Taglio', duration_minutes: 0 },
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(422)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('returns 404 when BARBER_NOT_FOUND thrown', async () => {
    vi.mocked(addBarberService).mockRejectedValue(new AppError('BARBER_NOT_FOUND', 404))

    const res = await app.inject({
      method: 'POST',
      url: '/barbers/b-1/services',
      payload: { name: 'Taglio', duration_minutes: 30 },
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'BARBER_NOT_FOUND' })
  })

  it('returns 403 when FORBIDDEN thrown', async () => {
    vi.mocked(addBarberService).mockRejectedValue(new AppError('FORBIDDEN', 403))

    const res = await app.inject({
      method: 'POST',
      url: '/barbers/b-1/services',
      payload: { name: 'Taglio', duration_minutes: 30 },
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'FORBIDDEN' })
  })

  it('accepts optional service_catalog_id and price', async () => {
    const catalogId = '00000000-0000-0000-0000-000000000001'
    const inserted = { id: 'svc-new', barber_id: 'b-1', service_catalog_id: catalogId, name: 'Taglio', duration_minutes: 30, price: '15.00', is_active: true }
    vi.mocked(addBarberService).mockResolvedValue(inserted)

    const res = await app.inject({
      method: 'POST',
      url: '/barbers/b-1/services',
      payload: { name: 'Taglio', duration_minutes: 30, service_catalog_id: catalogId, price: 15 },
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(201)
    expect(addBarberService).toHaveBeenCalledWith(
      'b-1',
      expect.objectContaining({ role: 'owner' }),
      { name: 'Taglio', duration_minutes: 30, service_catalog_id: catalogId, price: 15 }
    )
  })
})

describe('PATCH /barbers/:id/services/:serviceId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 204 on success', async () => {
    vi.mocked(updateBarberService).mockResolvedValue(undefined)

    const res = await app.inject({
      method: 'PATCH',
      url: '/barbers/b-1/services/svc-1',
      payload: { name: 'Taglio Aggiornato' },
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(204)
    expect(updateBarberService).toHaveBeenCalledWith(
      'b-1',
      'svc-1',
      expect.objectContaining({ role: 'owner' }),
      { name: 'Taglio Aggiornato' }
    )
  })

  it('calls requireAuth preHandler', async () => {
    vi.mocked(updateBarberService).mockResolvedValue(undefined)

    await app.inject({
      method: 'PATCH',
      url: '/barbers/b-1/services/svc-1',
      payload: { name: 'Updated' },
      headers: { authorization: 'Bearer token' },
    })

    expect(vi.mocked(requireAuth)).toHaveBeenCalled()
  })

  it('returns 404 when SERVICE_NOT_FOUND thrown', async () => {
    vi.mocked(updateBarberService).mockRejectedValue(new AppError('SERVICE_NOT_FOUND', 404))

    const res = await app.inject({
      method: 'PATCH',
      url: '/barbers/b-1/services/svc-1',
      payload: { name: 'Updated' },
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'SERVICE_NOT_FOUND' })
  })

  it('returns 404 when BARBER_NOT_FOUND thrown', async () => {
    vi.mocked(updateBarberService).mockRejectedValue(new AppError('BARBER_NOT_FOUND', 404))

    const res = await app.inject({
      method: 'PATCH',
      url: '/barbers/b-1/services/svc-1',
      payload: { name: 'Updated' },
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'BARBER_NOT_FOUND' })
  })

  it('returns 403 when FORBIDDEN thrown', async () => {
    vi.mocked(updateBarberService).mockRejectedValue(new AppError('FORBIDDEN', 403))

    const res = await app.inject({
      method: 'PATCH',
      url: '/barbers/b-1/services/svc-1',
      payload: { name: 'Updated' },
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'FORBIDDEN' })
  })

  it('returns 422 when name is empty string', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/barbers/b-1/services/svc-1',
      payload: { name: '' },
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(422)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('returns 422 when duration_minutes is negative', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/barbers/b-1/services/svc-1',
      payload: { duration_minutes: -1 },
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(422)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'VALIDATION_ERROR' })
  })
})

describe('DELETE /barbers/:id/services/:serviceId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 204 on success', async () => {
    vi.mocked(deleteBarberService).mockResolvedValue(undefined)

    const res = await app.inject({
      method: 'DELETE',
      url: '/barbers/b-1/services/svc-1',
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(204)
    expect(deleteBarberService).toHaveBeenCalledWith(
      'b-1',
      'svc-1',
      expect.objectContaining({ role: 'owner' })
    )
  })

  it('calls requireAuth preHandler', async () => {
    vi.mocked(deleteBarberService).mockResolvedValue(undefined)

    await app.inject({
      method: 'DELETE',
      url: '/barbers/b-1/services/svc-1',
      headers: { authorization: 'Bearer token' },
    })

    expect(vi.mocked(requireAuth)).toHaveBeenCalled()
  })

  it('returns 404 when SERVICE_NOT_FOUND thrown', async () => {
    vi.mocked(deleteBarberService).mockRejectedValue(new AppError('SERVICE_NOT_FOUND', 404))

    const res = await app.inject({
      method: 'DELETE',
      url: '/barbers/b-1/services/svc-1',
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'SERVICE_NOT_FOUND' })
  })

  it('returns 404 when BARBER_NOT_FOUND thrown', async () => {
    vi.mocked(deleteBarberService).mockRejectedValue(new AppError('BARBER_NOT_FOUND', 404))

    const res = await app.inject({
      method: 'DELETE',
      url: '/barbers/b-1/services/svc-1',
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'BARBER_NOT_FOUND' })
  })

  it('returns 403 when FORBIDDEN thrown', async () => {
    vi.mocked(deleteBarberService).mockRejectedValue(new AppError('FORBIDDEN', 403))

    const res = await app.inject({
      method: 'DELETE',
      url: '/barbers/b-1/services/svc-1',
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'FORBIDDEN' })
  })
})
