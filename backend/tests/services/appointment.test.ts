import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/db/pool', () => ({ db: { query: vi.fn(), connect: vi.fn() } }))
vi.mock('twilio', () => ({
  default: vi.fn().mockReturnValue({
    messages: { create: vi.fn().mockResolvedValue({ sid: 'SM123' }) },
  }),
}))

import { db } from '../../src/db/pool'
import twilio from 'twilio'
import {
  createAppointment,
  cancelAppointment,
  getBarberAppointments,
  getShopAppointments,
  updateAppointmentStatus,
  getCustomerAppointments,
} from '../../src/services/appointment'
import type { OwnerBarberPayload } from '../../src/lib/jwt'

const ownerUser: OwnerBarberPayload = { userId: 'user-1', role: 'owner', shopId: 'shop-1' }
const barberUser: OwnerBarberPayload = { userId: 'user-2', role: 'barber', shopId: 'shop-1' }

function makeMockClient(responses: Array<{ rows: unknown[]; rowCount: number }>) {
  let callIndex = 0
  return {
    query: vi.fn().mockImplementation(() => {
      const response = responses[callIndex] ?? { rows: [], rowCount: 0 }
      callIndex++
      return Promise.resolve(response)
    }),
    release: vi.fn(),
  }
}

describe('createAppointment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates appointment with SELECT FOR UPDATE, returns id/start/end', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [{ duration_minutes: 30 }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ shop_id: 'shop-1' }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ id: 'cust-1', phone: '+39123', name: 'Mario' }], rowCount: 1 } as any)

    const apptRow = { id: 'appt-1', start_time: '2025-03-17T09:00:00Z', end_time: '2025-03-17T09:30:00Z' }
    const mockClient = makeMockClient([
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: 0 },
      { rows: [apptRow], rowCount: 1 },
      { rows: [], rowCount: 0 },
    ])
    vi.mocked(db.connect).mockResolvedValue(mockClient as any)

    const result = await createAppointment(
      { barberId: 'b-1', serviceId: 'svc-1', startTime: '2025-03-17T09:00:00Z' },
      { customerId: 'cust-1', shopId: 'shop-1' }
    )
    expect(result).toMatchObject({ id: 'appt-1' })

    const forUpdateCall = mockClient.query.mock.calls[1][0] as string
    expect(forUpdateCall).toContain('FOR UPDATE')
    expect(forUpdateCall).toContain('tstzrange')
    expect(mockClient.release).toHaveBeenCalled()
  })

  it('throws SLOT_TAKEN on conflict, calls ROLLBACK', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [{ duration_minutes: 30 }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ shop_id: 'shop-1' }], rowCount: 1 } as any)

    const mockClient = makeMockClient([
      { rows: [], rowCount: 0 },
      { rows: [{ id: 'existing' }], rowCount: 1 },
    ])
    vi.mocked(db.connect).mockResolvedValue(mockClient as any)

    await expect(
      createAppointment(
        { barberId: 'b-1', serviceId: 'svc-1', startTime: '2025-03-17T09:00:00Z' },
        { customerId: 'cust-1', shopId: 'shop-1' }
      )
    ).rejects.toThrow('SLOT_TAKEN')
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK')
    expect(mockClient.release).toHaveBeenCalled()
  })

  it('throws SERVICE_NOT_FOUND when service query returns empty', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    await expect(
      createAppointment(
        { barberId: 'b-1', serviceId: 'svc-nonexistent', startTime: '2025-03-17T09:00:00Z' },
        { customerId: 'cust-1', shopId: 'shop-1' }
      )
    ).rejects.toMatchObject({ code: 'SERVICE_NOT_FOUND', statusCode: 404 })
  })

  it('throws BARBER_NOT_FOUND when barber query returns empty', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [{ duration_minutes: 30 }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    await expect(
      createAppointment(
        { barberId: 'barber-nonexistent', serviceId: 'svc-1', startTime: '2025-03-17T09:00:00Z' },
        { customerId: 'cust-1', shopId: 'shop-1' }
      )
    ).rejects.toMatchObject({ code: 'BARBER_NOT_FOUND', statusCode: 404 })
  })

  it('calls ROLLBACK and releases client on error', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [{ duration_minutes: 30 }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ shop_id: 'shop-1' }], rowCount: 1 } as any)

    const mockClient = makeMockClient([
      { rows: [], rowCount: 0 },
      { rows: [{ id: 'existing' }], rowCount: 1 },
    ])
    vi.mocked(db.connect).mockResolvedValue(mockClient as any)

    await expect(
      createAppointment(
        { barberId: 'b-1', serviceId: 'svc-1', startTime: '2025-03-17T09:00:00Z' },
        { customerId: 'cust-1', shopId: 'shop-1' }
      )
    ).rejects.toThrow()

    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK')
    expect(mockClient.release).toHaveBeenCalled()
  })
})

describe('cancelAppointment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws APPOINTMENT_NOT_FOUND when appointment not found', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    await expect(cancelAppointment('appt-nonexistent', 'cust-1')).rejects.toMatchObject({
      code: 'APPOINTMENT_NOT_FOUND',
      statusCode: 404,
    })
  })

  it('throws FORBIDDEN when customerId does not match', async () => {
    const later = new Date(Date.now() + 24 * 60 * 60 * 1000)
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [{ id: 'appt-1', customer_id: 'cust-other', start_time: later, status: 'confirmed' }],
      rowCount: 1,
    } as any)

    await expect(cancelAppointment('appt-1', 'cust-1')).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
    })
  })

  it('throws APPOINTMENT_ALREADY_CANCELLED when status is cancelled', async () => {
    const later = new Date(Date.now() + 24 * 60 * 60 * 1000)
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [{ id: 'appt-1', customer_id: 'cust-1', start_time: later, status: 'cancelled' }],
      rowCount: 1,
    } as any)

    await expect(cancelAppointment('appt-1', 'cust-1')).rejects.toMatchObject({
      code: 'APPOINTMENT_ALREADY_CANCELLED',
      statusCode: 409,
    })
  })

  it('throws CANCELLATION_TOO_LATE when < 12 hours until appointment', async () => {
    const soon = new Date(Date.now() + 6 * 60 * 60 * 1000)
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [{ id: 'appt-1', customer_id: 'cust-1', start_time: soon, status: 'confirmed' }],
      rowCount: 1,
    } as any)

    await expect(cancelAppointment('appt-1', 'cust-1')).rejects.toMatchObject({
      code: 'CANCELLATION_TOO_LATE',
      statusCode: 409,
    })
  })

  it('cancels successfully when > 12 hours until appointment', async () => {
    const later = new Date(Date.now() + 24 * 60 * 60 * 1000)
    vi.mocked(db.query)
      .mockResolvedValueOnce({
        rows: [{ id: 'appt-1', customer_id: 'cust-1', start_time: later, status: 'confirmed' }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    await expect(cancelAppointment('appt-1', 'cust-1')).resolves.toBeUndefined()
  })

  it('issues UPDATE with cancelled status', async () => {
    const later = new Date(Date.now() + 24 * 60 * 60 * 1000)
    vi.mocked(db.query)
      .mockResolvedValueOnce({
        rows: [{ id: 'appt-1', customer_id: 'cust-1', start_time: later, status: 'confirmed' }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    await cancelAppointment('appt-1', 'cust-1')

    const updateCall = vi.mocked(db.query).mock.calls[1]
    const sql = updateCall[0] as string
    expect(sql).toContain('UPDATE appointments')
    expect(sql).toContain("'cancelled'")
  })
})

describe('getCustomerAppointments', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns upcoming appointments (SQL contains start_time >= now())', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    await getCustomerAppointments('cust-1')

    const sql = vi.mocked(db.query).mock.calls[0][0] as string
    expect(sql).toContain('now()')
    expect(sql).toContain('start_time')
  })

  it('passes customerId as query param', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    await getCustomerAppointments('cust-42')

    const params = vi.mocked(db.query).mock.calls[0][1] as unknown[]
    expect(params).toContain('cust-42')
  })

  it('returns rows from query', async () => {
    const rows = [
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
    vi.mocked(db.query).mockResolvedValueOnce({ rows, rowCount: 1 } as any)

    const result = await getCustomerAppointments('cust-1')

    expect(result).toEqual(rows)
  })
})

describe('getBarberAppointments', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws BARBER_NOT_FOUND when barber does not exist', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    await expect(getBarberAppointments('barber-nonexistent', '2025-03-17', ownerUser)).rejects.toMatchObject({
      code: 'BARBER_NOT_FOUND',
      statusCode: 404,
    })
  })

  it('throws FORBIDDEN for barber accessing another barber appointments', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [{ user_id: 'user-other', shop_id: 'shop-1' }],
      rowCount: 1,
    } as any)

    await expect(getBarberAppointments('b-1', '2025-03-17', barberUser)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
    })
  })

  it('returns appointments for valid owner request', async () => {
    const apptRows = [
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
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [{ user_id: 'user-2', shop_id: 'shop-1' }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: apptRows, rowCount: 1 } as any)

    const result = await getBarberAppointments('b-1', '2025-03-17', ownerUser)

    expect(result).toEqual(apptRows)
  })

  it('allows barber to access their own appointments', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [{ user_id: 'user-2', shop_id: 'shop-1' }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    await expect(getBarberAppointments('b-1', '2025-03-17', barberUser)).resolves.toEqual([])
  })
})

describe('getShopAppointments', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws FORBIDDEN when user.shopId !== shopId', async () => {
    await expect(
      getShopAppointments('shop-other', '2025-03-17', ownerUser)
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 })
  })

  it('returns appointments for valid request', async () => {
    const rows = [
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
    vi.mocked(db.query).mockResolvedValueOnce({ rows, rowCount: 1 } as any)

    const result = await getShopAppointments('shop-1', '2025-03-17', ownerUser)

    expect(result).toEqual(rows)
  })

  it('passes shopId and date as query params', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    await getShopAppointments('shop-1', '2025-03-17', ownerUser)

    const params = vi.mocked(db.query).mock.calls[0][1] as unknown[]
    expect(params).toContain('shop-1')
    expect(params).toContain('2025-03-17')
  })
})

describe('updateAppointmentStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws APPOINTMENT_NOT_FOUND when appointment does not exist', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    await expect(
      updateAppointmentStatus('appt-nonexistent', 'completed', ownerUser)
    ).rejects.toMatchObject({ code: 'APPOINTMENT_NOT_FOUND', statusCode: 404 })
  })

  it('throws FORBIDDEN via authorizeBarberAccess when owner from different shop', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [{ id: 'appt-1', barber_user_id: 'user-2', shop_id: 'shop-other' }],
      rowCount: 1,
    } as any)

    await expect(
      updateAppointmentStatus('appt-1', 'completed', ownerUser)
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 })
  })

  it('updates status to completed', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({
        rows: [{ id: 'appt-1', barber_user_id: 'user-2', shop_id: 'shop-1' }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    await expect(
      updateAppointmentStatus('appt-1', 'completed', ownerUser)
    ).resolves.toBeUndefined()

    const updateCall = vi.mocked(db.query).mock.calls[1]
    const sql = updateCall[0] as string
    const params = updateCall[1] as unknown[]
    expect(sql).toContain('UPDATE appointments SET status')
    expect(params).toContain('completed')
    expect(params).toContain('appt-1')
  })

  it('updates status to no_show', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({
        rows: [{ id: 'appt-1', barber_user_id: 'user-2', shop_id: 'shop-1' }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    await expect(
      updateAppointmentStatus('appt-1', 'no_show', ownerUser)
    ).resolves.toBeUndefined()

    const updateCall = vi.mocked(db.query).mock.calls[1]
    const params = updateCall[1] as unknown[]
    expect(params).toContain('no_show')
  })
})
