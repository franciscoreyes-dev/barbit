import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/services/appointment', () => ({
  createAppointment: vi.fn(),
  getCustomerAppointments: vi.fn(),
  cancelAppointment: vi.fn(),
  getBarberAppointments: vi.fn(),
  getShopAppointments: vi.fn(),
  updateAppointmentStatus: vi.fn(),
}))

vi.mock('../../src/lib/require-customer', () => ({
  requireCustomer: vi.fn().mockImplementation(async (req: any) => {
    req.customer = { customerId: 'cust-1', shopId: 'shop-1' }
  }),
}))

vi.mock('../../src/lib/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async (req: any) => {
    req.user = { userId: 'user-1', role: 'owner', shopId: 'shop-1' }
  }),
  requireOwner: vi.fn().mockImplementation(async (req: any) => {
    req.user = { userId: 'user-1', role: 'owner', shopId: 'shop-1' }
  }),
}))

import {
  createAppointment,
  getCustomerAppointments,
  cancelAppointment,
  getBarberAppointments,
  getShopAppointments,
  updateAppointmentStatus,
} from '../../src/services/appointment'
import { requireCustomer } from '../../src/lib/require-customer'
import { requireAuth, requireOwner } from '../../src/lib/require-auth'
import { AppError } from '../../src/lib/errors'
import Fastify from 'fastify'
import { appointmentRoutes } from '../../src/routes/appointments'

function buildTestApp() {
  const app = Fastify({ logger: false })
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof AppError) reply.code(error.statusCode).send({ code: error.code })
    else reply.code(500).send({ code: 'INTERNAL_SERVER_ERROR' })
  })
  app.register(appointmentRoutes)
  return app
}

const app = buildTestApp()

describe('POST /appointments', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 201 with created appointment', async () => {
    const appt = { id: 'appt-1', start_time: '2025-03-17T09:00:00Z', end_time: '2025-03-17T09:30:00Z' }
    vi.mocked(createAppointment).mockResolvedValue(appt)

    const res = await app.inject({
      method: 'POST',
      url: '/appointments',
      payload: {
        barberId: '00000000-0000-0000-0000-000000000001',
        serviceId: '00000000-0000-0000-0000-000000000002',
        startTime: '2025-03-17T09:00:00Z',
      },
      headers: { authorization: 'Bearer token' },
    })

    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.body)).toEqual(appt)
    expect(vi.mocked(requireCustomer)).toHaveBeenCalled()
  })

  it('calls createAppointment with parsed data and customer', async () => {
    const appt = { id: 'appt-1', start_time: '2025-03-17T09:00:00Z', end_time: '2025-03-17T09:30:00Z' }
    vi.mocked(createAppointment).mockResolvedValue(appt)

    await app.inject({
      method: 'POST',
      url: '/appointments',
      payload: {
        barberId: '00000000-0000-0000-0000-000000000001',
        serviceId: '00000000-0000-0000-0000-000000000002',
        startTime: '2025-03-17T09:00:00Z',
      },
      headers: { authorization: 'Bearer token' },
    })

    expect(createAppointment).toHaveBeenCalledWith(
      {
        barberId: '00000000-0000-0000-0000-000000000001',
        serviceId: '00000000-0000-0000-0000-000000000002',
        startTime: '2025-03-17T09:00:00Z',
      },
      expect.objectContaining({ customerId: 'cust-1' })
    )
  })

  it('returns 422 when barberId is not a UUID', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/appointments',
      payload: {
        barberId: 'not-a-uuid',
        serviceId: '00000000-0000-0000-0000-000000000002',
        startTime: '2025-03-17T09:00:00Z',
      },
      headers: { authorization: 'Bearer token' },
    })

    expect(res.statusCode).toBe(422)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('returns 422 when startTime is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/appointments',
      payload: {
        barberId: '00000000-0000-0000-0000-000000000001',
        serviceId: '00000000-0000-0000-0000-000000000002',
      },
      headers: { authorization: 'Bearer token' },
    })

    expect(res.statusCode).toBe(422)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('returns 422 when startTime is not a valid datetime', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/appointments',
      payload: {
        barberId: '00000000-0000-0000-0000-000000000001',
        serviceId: '00000000-0000-0000-0000-000000000002',
        startTime: 'not-a-datetime',
      },
      headers: { authorization: 'Bearer token' },
    })

    expect(res.statusCode).toBe(422)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('returns 409 when SLOT_TAKEN thrown', async () => {
    vi.mocked(createAppointment).mockRejectedValue(new AppError('SLOT_TAKEN', 409))

    const res = await app.inject({
      method: 'POST',
      url: '/appointments',
      payload: {
        barberId: '00000000-0000-0000-0000-000000000001',
        serviceId: '00000000-0000-0000-0000-000000000002',
        startTime: '2025-03-17T09:00:00Z',
      },
      headers: { authorization: 'Bearer token' },
    })

    expect(res.statusCode).toBe(409)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'SLOT_TAKEN' })
  })

  it('returns 404 when SERVICE_NOT_FOUND thrown', async () => {
    vi.mocked(createAppointment).mockRejectedValue(new AppError('SERVICE_NOT_FOUND', 404))

    const res = await app.inject({
      method: 'POST',
      url: '/appointments',
      payload: {
        barberId: '00000000-0000-0000-0000-000000000001',
        serviceId: '00000000-0000-0000-0000-000000000002',
        startTime: '2025-03-17T09:00:00Z',
      },
      headers: { authorization: 'Bearer token' },
    })

    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'SERVICE_NOT_FOUND' })
  })
})

describe('GET /appointments/mine', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with customer appointments', async () => {
    const appts = [
      {
        id: 'appt-1',
        start_time: '2025-03-17T09:00:00Z',
        end_time: '2025-03-17T09:30:00Z',
        status: 'confirmed',
        barber_name: 'Mario',
        service_name: 'Taglio',
        price: '15.00',
        shop_name: 'Barberia Mario',
      },
    ]
    vi.mocked(getCustomerAppointments).mockResolvedValue(appts)

    const res = await app.inject({
      method: 'GET',
      url: '/appointments/mine',
      headers: { authorization: 'Bearer token' },
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual(appts)
    expect(vi.mocked(requireCustomer)).toHaveBeenCalled()
  })

  it('calls getCustomerAppointments with customerId from customer payload', async () => {
    vi.mocked(getCustomerAppointments).mockResolvedValue([])

    await app.inject({
      method: 'GET',
      url: '/appointments/mine',
      headers: { authorization: 'Bearer token' },
    })

    expect(getCustomerAppointments).toHaveBeenCalledWith('cust-1')
  })

  it('returns 200 with empty array when no appointments', async () => {
    vi.mocked(getCustomerAppointments).mockResolvedValue([])

    const res = await app.inject({
      method: 'GET',
      url: '/appointments/mine',
      headers: { authorization: 'Bearer token' },
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual([])
  })
})

describe('DELETE /appointments/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 204 on successful cancellation', async () => {
    vi.mocked(cancelAppointment).mockResolvedValue(undefined)

    const res = await app.inject({
      method: 'DELETE',
      url: '/appointments/appt-1',
      headers: { authorization: 'Bearer token' },
    })

    expect(res.statusCode).toBe(204)
    expect(vi.mocked(requireCustomer)).toHaveBeenCalled()
  })

  it('calls cancelAppointment with id and customerId', async () => {
    vi.mocked(cancelAppointment).mockResolvedValue(undefined)

    await app.inject({
      method: 'DELETE',
      url: '/appointments/appt-1',
      headers: { authorization: 'Bearer token' },
    })

    expect(cancelAppointment).toHaveBeenCalledWith('appt-1', 'cust-1')
  })

  it('returns 409 when CANCELLATION_TOO_LATE thrown', async () => {
    vi.mocked(cancelAppointment).mockRejectedValue(new AppError('CANCELLATION_TOO_LATE', 409))

    const res = await app.inject({
      method: 'DELETE',
      url: '/appointments/appt-1',
      headers: { authorization: 'Bearer token' },
    })

    expect(res.statusCode).toBe(409)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'CANCELLATION_TOO_LATE' })
  })

  it('returns 409 when APPOINTMENT_ALREADY_CANCELLED thrown', async () => {
    vi.mocked(cancelAppointment).mockRejectedValue(new AppError('APPOINTMENT_ALREADY_CANCELLED', 409))

    const res = await app.inject({
      method: 'DELETE',
      url: '/appointments/appt-1',
      headers: { authorization: 'Bearer token' },
    })

    expect(res.statusCode).toBe(409)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'APPOINTMENT_ALREADY_CANCELLED' })
  })

  it('returns 404 when APPOINTMENT_NOT_FOUND thrown', async () => {
    vi.mocked(cancelAppointment).mockRejectedValue(new AppError('APPOINTMENT_NOT_FOUND', 404))

    const res = await app.inject({
      method: 'DELETE',
      url: '/appointments/appt-1',
      headers: { authorization: 'Bearer token' },
    })

    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'APPOINTMENT_NOT_FOUND' })
  })

  it('returns 403 when FORBIDDEN thrown', async () => {
    vi.mocked(cancelAppointment).mockRejectedValue(new AppError('FORBIDDEN', 403))

    const res = await app.inject({
      method: 'DELETE',
      url: '/appointments/appt-1',
      headers: { authorization: 'Bearer token' },
    })

    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'FORBIDDEN' })
  })
})

describe('GET /barbers/:id/appointments', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with barber appointments', async () => {
    const appts = [
      {
        id: 'appt-1',
        start_time: '2025-03-17T09:00:00Z',
        end_time: '2025-03-17T09:30:00Z',
        status: 'confirmed',
        customer_name: 'Mario',
        customer_phone: '+39123',
        service_name: 'Taglio',
        price: '15.00',
      },
    ]
    vi.mocked(getBarberAppointments).mockResolvedValue(appts)

    const res = await app.inject({
      method: 'GET',
      url: '/barbers/b-1/appointments?date=2025-03-17',
      headers: { authorization: 'Bearer token' },
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual(appts)
    expect(vi.mocked(requireAuth)).toHaveBeenCalled()
  })

  it('calls getBarberAppointments with id, date, user', async () => {
    vi.mocked(getBarberAppointments).mockResolvedValue([])

    await app.inject({
      method: 'GET',
      url: '/barbers/b-1/appointments?date=2025-03-17',
      headers: { authorization: 'Bearer token' },
    })

    expect(getBarberAppointments).toHaveBeenCalledWith(
      'b-1',
      '2025-03-17',
      expect.objectContaining({ role: 'owner' })
    )
  })

  it('returns 422 when date query param is missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/barbers/b-1/appointments',
      headers: { authorization: 'Bearer token' },
    })

    expect(res.statusCode).toBe(422)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('returns 404 when BARBER_NOT_FOUND thrown', async () => {
    vi.mocked(getBarberAppointments).mockRejectedValue(new AppError('BARBER_NOT_FOUND', 404))

    const res = await app.inject({
      method: 'GET',
      url: '/barbers/b-1/appointments?date=2025-03-17',
      headers: { authorization: 'Bearer token' },
    })

    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'BARBER_NOT_FOUND' })
  })

  it('returns 403 when FORBIDDEN thrown', async () => {
    vi.mocked(getBarberAppointments).mockRejectedValue(new AppError('FORBIDDEN', 403))

    const res = await app.inject({
      method: 'GET',
      url: '/barbers/b-1/appointments?date=2025-03-17',
      headers: { authorization: 'Bearer token' },
    })

    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'FORBIDDEN' })
  })
})

describe('GET /shops/:id/appointments', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with shop appointments', async () => {
    const appts = [
      {
        id: 'appt-1',
        start_time: '2025-03-17T09:00:00Z',
        end_time: '2025-03-17T09:30:00Z',
        status: 'confirmed',
        barber_name: 'Mario',
        customer_name: 'Luigi',
        customer_phone: '+39456',
        service_name: 'Taglio',
        price: '15.00',
      },
    ]
    vi.mocked(getShopAppointments).mockResolvedValue(appts)

    const res = await app.inject({
      method: 'GET',
      url: '/shops/shop-1/appointments?date=2025-03-17',
      headers: { authorization: 'Bearer token' },
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual(appts)
    expect(vi.mocked(requireOwner)).toHaveBeenCalled()
  })

  it('calls getShopAppointments with id, date, user', async () => {
    vi.mocked(getShopAppointments).mockResolvedValue([])

    await app.inject({
      method: 'GET',
      url: '/shops/shop-1/appointments?date=2025-03-17',
      headers: { authorization: 'Bearer token' },
    })

    expect(getShopAppointments).toHaveBeenCalledWith(
      'shop-1',
      '2025-03-17',
      expect.objectContaining({ role: 'owner' })
    )
  })

  it('returns 422 when date query param is missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/shops/shop-1/appointments',
      headers: { authorization: 'Bearer token' },
    })

    expect(res.statusCode).toBe(422)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('returns 403 when FORBIDDEN thrown', async () => {
    vi.mocked(getShopAppointments).mockRejectedValue(new AppError('FORBIDDEN', 403))

    const res = await app.inject({
      method: 'GET',
      url: '/shops/shop-1/appointments?date=2025-03-17',
      headers: { authorization: 'Bearer token' },
    })

    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'FORBIDDEN' })
  })
})

describe('PATCH /appointments/:id/status', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 204 on successful status update', async () => {
    vi.mocked(updateAppointmentStatus).mockResolvedValue(undefined)

    const res = await app.inject({
      method: 'PATCH',
      url: '/appointments/appt-1/status',
      payload: { status: 'completed' },
      headers: { authorization: 'Bearer token' },
    })

    expect(res.statusCode).toBe(204)
    expect(vi.mocked(requireAuth)).toHaveBeenCalled()
  })

  it('calls updateAppointmentStatus with id, status, user', async () => {
    vi.mocked(updateAppointmentStatus).mockResolvedValue(undefined)

    await app.inject({
      method: 'PATCH',
      url: '/appointments/appt-1/status',
      payload: { status: 'no_show' },
      headers: { authorization: 'Bearer token' },
    })

    expect(updateAppointmentStatus).toHaveBeenCalledWith(
      'appt-1',
      'no_show',
      expect.objectContaining({ role: 'owner' })
    )
  })

  it('returns 422 when status is an invalid value', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/appointments/appt-1/status',
      payload: { status: 'confirmed' },
      headers: { authorization: 'Bearer token' },
    })

    expect(res.statusCode).toBe(422)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('returns 422 when status is missing', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/appointments/appt-1/status',
      payload: {},
      headers: { authorization: 'Bearer token' },
    })

    expect(res.statusCode).toBe(422)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('returns 404 when APPOINTMENT_NOT_FOUND thrown', async () => {
    vi.mocked(updateAppointmentStatus).mockRejectedValue(new AppError('APPOINTMENT_NOT_FOUND', 404))

    const res = await app.inject({
      method: 'PATCH',
      url: '/appointments/appt-1/status',
      payload: { status: 'completed' },
      headers: { authorization: 'Bearer token' },
    })

    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'APPOINTMENT_NOT_FOUND' })
  })

  it('returns 403 when FORBIDDEN thrown', async () => {
    vi.mocked(updateAppointmentStatus).mockRejectedValue(new AppError('FORBIDDEN', 403))

    const res = await app.inject({
      method: 'PATCH',
      url: '/appointments/appt-1/status',
      payload: { status: 'completed' },
      headers: { authorization: 'Bearer token' },
    })

    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.body)).toMatchObject({ code: 'FORBIDDEN' })
  })
})
