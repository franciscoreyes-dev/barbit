import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/services/availability', () => ({
  getSchedule: vi.fn(),
  upsertSchedule: vi.fn(),
  getExceptions: vi.fn(),
  addException: vi.fn(),
  deleteException: vi.fn(),
  getAvailableSlots: vi.fn(),
}))

vi.mock('../../src/lib/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async (req: any) => {
    req.user = { userId: 'user-1', role: 'owner', shopId: 'shop-1' }
  }),
}))

import { getSchedule, upsertSchedule, getExceptions, addException, deleteException, getAvailableSlots } from '../../src/services/availability'
import { requireAuth } from '../../src/lib/require-auth'
import { AppError } from '../../src/lib/errors'
import Fastify from 'fastify'
import { availabilityRoutes } from '../../src/routes/availability'

function buildTestApp() {
  const app = Fastify({ logger: false })
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof AppError) reply.code(error.statusCode).send({ code: error.code })
    else reply.code(500).send({ code: 'INTERNAL_SERVER_ERROR' })
  })
  app.register(availabilityRoutes)
  return app
}

const app = buildTestApp()

const validDays = Array.from({ length: 7 }, (_, i) => ({
  day_of_week: i,
  start_time: '09:00',
  end_time: '18:00',
  is_working: i >= 1 && i <= 5,
}))

describe('GET /barbers/:id/schedule', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with schedule (public endpoint)', async () => {
    const schedule = [{ day_of_week: 1, start_time: '09:00', end_time: '18:00', is_working: true }]
    vi.mocked(getSchedule).mockResolvedValue(schedule)

    const res = await app.inject({ method: 'GET', url: '/barbers/b-1/schedule' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual(schedule)
    expect(getSchedule).toHaveBeenCalledWith('b-1')
  })

  it('does NOT call requireAuth (public endpoint)', async () => {
    vi.mocked(getSchedule).mockResolvedValue([])

    await app.inject({ method: 'GET', url: '/barbers/b-1/schedule' })
    expect(vi.mocked(requireAuth)).not.toHaveBeenCalled()
  })

  it('returns 200 with empty array when no schedule', async () => {
    vi.mocked(getSchedule).mockResolvedValue([])

    const res = await app.inject({ method: 'GET', url: '/barbers/b-1/schedule' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual([])
  })
})

describe('PUT /barbers/:id/schedule', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 204 with valid 7-day array', async () => {
    vi.mocked(upsertSchedule).mockResolvedValue(undefined)

    const res = await app.inject({
      method: 'PUT',
      url: '/barbers/b-1/schedule',
      payload: { days: validDays },
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(204)
    expect(upsertSchedule).toHaveBeenCalledWith(
      'b-1',
      expect.objectContaining({ role: 'owner' }),
      validDays
    )
  })

  it('calls requireAuth preHandler', async () => {
    vi.mocked(upsertSchedule).mockResolvedValue(undefined)

    await app.inject({
      method: 'PUT',
      url: '/barbers/b-1/schedule',
      payload: { days: validDays },
      headers: { authorization: 'Bearer token' },
    })
    expect(vi.mocked(requireAuth)).toHaveBeenCalled()
  })

  it('returns 422 when days array has only 3 items', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/barbers/b-1/schedule',
      payload: { days: validDays.slice(0, 3) },
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(422)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('returns 422 when time format is invalid', async () => {
    const badDays = validDays.map((d, i) =>
      i === 0 ? { ...d, start_time: '9:00' } : d
    )
    const res = await app.inject({
      method: 'PUT',
      url: '/barbers/b-1/schedule',
      payload: { days: badDays },
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(422)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('returns 422 when days array has 8 items', async () => {
    const tooManyDays = [...validDays, { day_of_week: 7, start_time: '09:00', end_time: '18:00', is_working: false }]
    const res = await app.inject({
      method: 'PUT',
      url: '/barbers/b-1/schedule',
      payload: { days: tooManyDays },
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(422)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('returns 404 when BARBER_NOT_FOUND thrown', async () => {
    vi.mocked(upsertSchedule).mockRejectedValue(new AppError('BARBER_NOT_FOUND', 404))

    const res = await app.inject({
      method: 'PUT',
      url: '/barbers/b-1/schedule',
      payload: { days: validDays },
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'BARBER_NOT_FOUND' })
  })

  it('returns 403 when FORBIDDEN thrown', async () => {
    vi.mocked(upsertSchedule).mockRejectedValue(new AppError('FORBIDDEN', 403))

    const res = await app.inject({
      method: 'PUT',
      url: '/barbers/b-1/schedule',
      payload: { days: validDays },
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'FORBIDDEN' })
  })
})

describe('GET /barbers/:id/exceptions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with exceptions (public endpoint)', async () => {
    const exceptions = [{ date: '2025-03-15', is_off: true, start_time: null, end_time: null, reason: null }]
    vi.mocked(getExceptions).mockResolvedValue(exceptions)

    const res = await app.inject({ method: 'GET', url: '/barbers/b-1/exceptions' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual(exceptions)
    expect(getExceptions).toHaveBeenCalledWith('b-1', undefined, undefined)
  })

  it('does NOT call requireAuth (public endpoint)', async () => {
    vi.mocked(getExceptions).mockResolvedValue([])

    await app.inject({ method: 'GET', url: '/barbers/b-1/exceptions' })
    expect(vi.mocked(requireAuth)).not.toHaveBeenCalled()
  })

  it('passes from and to query params', async () => {
    vi.mocked(getExceptions).mockResolvedValue([])

    const res = await app.inject({
      method: 'GET',
      url: '/barbers/b-1/exceptions?from=2025-03-01&to=2025-03-31',
    })
    expect(res.statusCode).toBe(200)
    expect(getExceptions).toHaveBeenCalledWith('b-1', '2025-03-01', '2025-03-31')
  })
})

describe('POST /barbers/:id/exceptions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 201 on success', async () => {
    vi.mocked(addException).mockResolvedValue(undefined)

    const res = await app.inject({
      method: 'POST',
      url: '/barbers/b-1/exceptions',
      payload: { date: '2025-03-15', is_off: true },
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(201)
    expect(addException).toHaveBeenCalledWith(
      'b-1',
      expect.objectContaining({ role: 'owner' }),
      { date: '2025-03-15', is_off: true }
    )
  })

  it('calls requireAuth preHandler', async () => {
    vi.mocked(addException).mockResolvedValue(undefined)

    await app.inject({
      method: 'POST',
      url: '/barbers/b-1/exceptions',
      payload: { date: '2025-03-15', is_off: true },
      headers: { authorization: 'Bearer token' },
    })
    expect(vi.mocked(requireAuth)).toHaveBeenCalled()
  })

  it('returns 422 when date format is invalid', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/barbers/b-1/exceptions',
      payload: { date: '15-03-2025', is_off: true },
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(422)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('returns 422 when is_off is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/barbers/b-1/exceptions',
      payload: { date: '2025-03-15' },
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(422)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('accepts optional start_time, end_time, reason fields', async () => {
    vi.mocked(addException).mockResolvedValue(undefined)

    const res = await app.inject({
      method: 'POST',
      url: '/barbers/b-1/exceptions',
      payload: { date: '2025-03-15', is_off: false, start_time: '10:00', end_time: '16:00', reason: 'Ferie' },
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(201)
    expect(addException).toHaveBeenCalledWith(
      'b-1',
      expect.objectContaining({ role: 'owner' }),
      { date: '2025-03-15', is_off: false, start_time: '10:00', end_time: '16:00', reason: 'Ferie' }
    )
  })

  it('returns 404 when BARBER_NOT_FOUND thrown', async () => {
    vi.mocked(addException).mockRejectedValue(new AppError('BARBER_NOT_FOUND', 404))

    const res = await app.inject({
      method: 'POST',
      url: '/barbers/b-1/exceptions',
      payload: { date: '2025-03-15', is_off: true },
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'BARBER_NOT_FOUND' })
  })

  it('returns 403 when FORBIDDEN thrown', async () => {
    vi.mocked(addException).mockRejectedValue(new AppError('FORBIDDEN', 403))

    const res = await app.inject({
      method: 'POST',
      url: '/barbers/b-1/exceptions',
      payload: { date: '2025-03-15', is_off: true },
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'FORBIDDEN' })
  })
})

describe('DELETE /barbers/:id/exceptions/:date', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 204 on success', async () => {
    vi.mocked(deleteException).mockResolvedValue(undefined)

    const res = await app.inject({
      method: 'DELETE',
      url: '/barbers/b-1/exceptions/2025-03-15',
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(204)
    expect(deleteException).toHaveBeenCalledWith(
      'b-1',
      '2025-03-15',
      expect.objectContaining({ role: 'owner' })
    )
  })

  it('calls requireAuth preHandler', async () => {
    vi.mocked(deleteException).mockResolvedValue(undefined)

    await app.inject({
      method: 'DELETE',
      url: '/barbers/b-1/exceptions/2025-03-15',
      headers: { authorization: 'Bearer token' },
    })
    expect(vi.mocked(requireAuth)).toHaveBeenCalled()
  })

  it('returns 404 when BARBER_NOT_FOUND thrown', async () => {
    vi.mocked(deleteException).mockRejectedValue(new AppError('BARBER_NOT_FOUND', 404))

    const res = await app.inject({
      method: 'DELETE',
      url: '/barbers/b-1/exceptions/2025-03-15',
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'BARBER_NOT_FOUND' })
  })

  it('returns 403 when FORBIDDEN thrown', async () => {
    vi.mocked(deleteException).mockRejectedValue(new AppError('FORBIDDEN', 403))

    const res = await app.inject({
      method: 'DELETE',
      url: '/barbers/b-1/exceptions/2025-03-15',
      headers: { authorization: 'Bearer token' },
    })
    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'FORBIDDEN' })
  })
})

describe('GET /barbers/:id/slots', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns slots array on success', async () => {
    vi.mocked(getAvailableSlots).mockResolvedValue(['2025-03-17T09:00:00.000Z'])
    const res = await app.inject({ method: 'GET', url: '/barbers/b-1/slots?date=2025-03-17&serviceId=svc-1' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toMatchObject({ slots: ['2025-03-17T09:00:00.000Z'] })
  })

  it('returns 422 when date is missing', async () => {
    const res = await app.inject({ method: 'GET', url: '/barbers/b-1/slots?serviceId=svc-1' })
    expect(res.statusCode).toBe(422)
  })

  it('returns 422 when serviceId is missing', async () => {
    const res = await app.inject({ method: 'GET', url: '/barbers/b-1/slots?date=2025-03-17' })
    expect(res.statusCode).toBe(422)
  })

  it('returns 404 when SERVICE_NOT_FOUND', async () => {
    vi.mocked(getAvailableSlots).mockRejectedValue(new AppError('SERVICE_NOT_FOUND', 404))
    const res = await app.inject({ method: 'GET', url: '/barbers/b-1/slots?date=2025-03-17&serviceId=svc-1' })
    expect(res.statusCode).toBe(404)
  })
})
