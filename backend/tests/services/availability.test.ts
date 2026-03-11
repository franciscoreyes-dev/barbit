import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/db/pool', () => ({
  db: {
    query: vi.fn(),
    connect: vi.fn(),
  },
}))

import { db } from '../../src/db/pool'
import { getSchedule, upsertSchedule, getExceptions, addException, deleteException, getAvailableSlots } from '../../src/services/availability'
import { AppError } from '../../src/lib/errors'

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

const ownerUser = { userId: 'owner-1', role: 'owner' as const, shopId: 'shop-1' }
const barberUser = { userId: 'user-1', role: 'barber' as const, shopId: 'shop-1' }

describe('getSchedule', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns schedule days ordered by day_of_week', async () => {
    const rows = [
      { day_of_week: 0, start_time: '09:00', end_time: '18:00', is_working: false },
      { day_of_week: 1, start_time: '09:00', end_time: '18:00', is_working: true },
    ]
    vi.mocked(db.query).mockResolvedValueOnce({ rows, rowCount: 2 } as any)

    const result = await getSchedule('b-1')
    expect(result).toEqual(rows)
    expect(vi.mocked(db.query).mock.calls[0][0]).toContain('ORDER BY day_of_week')
    expect(vi.mocked(db.query).mock.calls[0][1]).toEqual(['b-1'])
  })

  it('returns empty array when no schedule exists', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    const result = await getSchedule('b-1')
    expect(result).toEqual([])
  })
})

describe('upsertSchedule', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws BARBER_NOT_FOUND when barber does not exist', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    await expect(upsertSchedule('nonexistent', ownerUser, [])).rejects.toThrow('BARBER_NOT_FOUND')
    expect(vi.mocked(db.query).mock.calls[0][1]).toEqual(['nonexistent'])
  })

  it('throws FORBIDDEN when owner belongs to different shop', async () => {
    const barberRow = { id: 'b-1', user_id: 'user-1', shop_id: 'shop-2' }
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [barberRow], rowCount: 1 } as any)

    const wrongOwner = { userId: 'owner-1', role: 'owner' as const, shopId: 'shop-1' }
    await expect(upsertSchedule('b-1', wrongOwner, [])).rejects.toThrow('FORBIDDEN')
  })

  it('throws FORBIDDEN when barber tries to update another barber schedule', async () => {
    const barberRow = { id: 'b-1', user_id: 'user-2', shop_id: 'shop-1' }
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [barberRow], rowCount: 1 } as any)

    await expect(upsertSchedule('b-1', barberUser, [])).rejects.toThrow('FORBIDDEN')
  })

  it('executes BEGIN, DELETE, INSERT for each day, and COMMIT in transaction', async () => {
    const barberRow = { id: 'b-1', user_id: 'user-1', shop_id: 'shop-1' }
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [barberRow], rowCount: 1 } as any)

    const days = [
      { day_of_week: 1, start_time: '09:00', end_time: '18:00', is_working: true },
      { day_of_week: 2, start_time: '09:00', end_time: '18:00', is_working: true },
    ]

    const mockClient = makeMockClient([
      { rows: [], rowCount: 0 }, // BEGIN
      { rows: [], rowCount: 0 }, // DELETE
      { rows: [], rowCount: 0 }, // INSERT day 1
      { rows: [], rowCount: 0 }, // INSERT day 2
      { rows: [], rowCount: 0 }, // COMMIT
    ])
    vi.mocked(db.connect).mockResolvedValue(mockClient as any)

    await upsertSchedule('b-1', barberUser, days)

    const calls = mockClient.query.mock.calls.map((c) => c[0] as string)
    expect(calls[0]).toBe('BEGIN')
    expect(calls[1]).toContain('DELETE FROM weekly_schedule')
    expect(calls[2]).toContain('INSERT INTO weekly_schedule')
    expect(calls[3]).toContain('INSERT INTO weekly_schedule')
    expect(calls[4]).toBe('COMMIT')
    expect(mockClient.release).toHaveBeenCalled()
  })

  it('rolls back transaction on DB error during INSERT', async () => {
    const barberRow = { id: 'b-1', user_id: 'user-1', shop_id: 'shop-1' }
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [barberRow], rowCount: 1 } as any)

    const mockClient = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // DELETE
        .mockRejectedValueOnce(new Error('DB error')),    // INSERT fails
      release: vi.fn(),
    }
    vi.mocked(db.connect).mockResolvedValue(mockClient as any)

    await expect(upsertSchedule('b-1', { userId: 'user-1', role: 'barber', shopId: 'shop-1' }, [])).rejects.toThrow('DB error')
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK')
    expect(mockClient.release).toHaveBeenCalled()
  })

  it('allows owner of same shop to upsert schedule', async () => {
    const barberRow = { id: 'b-1', user_id: 'user-1', shop_id: 'shop-1' }
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [barberRow], rowCount: 1 } as any)

    const mockClient = makeMockClient([
      { rows: [], rowCount: 0 }, // BEGIN
      { rows: [], rowCount: 0 }, // DELETE
      { rows: [], rowCount: 0 }, // COMMIT
    ])
    vi.mocked(db.connect).mockResolvedValue(mockClient as any)

    await expect(upsertSchedule('b-1', ownerUser, [])).resolves.toBeUndefined()
  })
})

describe('getExceptions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns exceptions for a barber', async () => {
    const rows = [
      { date: '2025-03-10', is_off: false, start_time: '10:00', end_time: '17:00', reason: null },
    ]
    vi.mocked(db.query).mockResolvedValueOnce({ rows, rowCount: 1 } as any)

    const result = await getExceptions('b-1')
    expect(result).toEqual(rows)
    expect(vi.mocked(db.query).mock.calls[0][1]).toEqual(['b-1'])
  })

  it('filters by date range when from and to are provided', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
    await getExceptions('b-1', '2025-03-01', '2025-03-31')
    const sql = vi.mocked(db.query).mock.calls[0][0] as string
    expect(sql).toContain('date >=')
    expect(sql).toContain('date <=')
    expect(vi.mocked(db.query).mock.calls[0][1]).toEqual(['b-1', '2025-03-01', '2025-03-31'])
  })

  it('returns only barber exceptions when no date range', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
    await getExceptions('b-1')
    const sql = vi.mocked(db.query).mock.calls[0][0] as string
    expect(sql).not.toContain('date >=')
    expect(sql).not.toContain('date <=')
    expect(vi.mocked(db.query).mock.calls[0][1]).toEqual(['b-1'])
  })

  it('normalizes date from Date object to ISO string', async () => {
    const rows = [
      { date: new Date('2025-03-10T00:00:00.000Z'), is_off: false, start_time: null, end_time: null, reason: null },
    ]
    vi.mocked(db.query).mockResolvedValueOnce({ rows, rowCount: 1 } as any)

    const result = await getExceptions('b-1')
    expect(typeof result[0].date).toBe('string')
    expect(result[0].date).toBe('2025-03-10')
  })
})

describe('addException', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws BARBER_NOT_FOUND when barber does not exist', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    await expect(
      addException('nonexistent', ownerUser, { date: '2025-03-15', is_off: true })
    ).rejects.toThrow('BARBER_NOT_FOUND')
  })

  it('throws FORBIDDEN when not authorized', async () => {
    const barberRow = { id: 'b-1', user_id: 'user-2', shop_id: 'shop-1' }
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [barberRow], rowCount: 1 } as any)

    await expect(
      addException('b-1', barberUser, { date: '2025-03-15', is_off: true })
    ).rejects.toThrow('FORBIDDEN')
  })

  it('SQL contains ON CONFLICT clause', async () => {
    const barberRow = { id: 'b-1', user_id: 'user-1', shop_id: 'shop-1' }
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [barberRow], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    await addException('b-1', barberUser, { date: '2025-03-15', is_off: true })
    const sql = vi.mocked(db.query).mock.calls[1][0] as string
    expect(sql).toContain('ON CONFLICT')
  })

  it('uses null defaults for optional fields', async () => {
    const barberRow = { id: 'b-1', user_id: 'user-1', shop_id: 'shop-1' }
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [barberRow], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    await addException('b-1', barberUser, { date: '2025-03-15', is_off: false })
    const params = vi.mocked(db.query).mock.calls[1][1] as unknown[]
    expect(params).toContain(null)
  })

  it('inserts with provided optional fields', async () => {
    const barberRow = { id: 'b-1', user_id: 'user-1', shop_id: 'shop-1' }
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [barberRow], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    await addException('b-1', barberUser, {
      date: '2025-03-15',
      is_off: false,
      start_time: '10:00',
      end_time: '16:00',
      reason: 'Ferie',
    })
    const params = vi.mocked(db.query).mock.calls[1][1] as unknown[]
    expect(params).toContain('10:00')
    expect(params).toContain('16:00')
    expect(params).toContain('Ferie')
  })
})

describe('deleteException', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws BARBER_NOT_FOUND when barber does not exist', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    await expect(deleteException('nonexistent', '2025-03-15', ownerUser)).rejects.toThrow('BARBER_NOT_FOUND')
  })

  it('throws FORBIDDEN when not authorized', async () => {
    const barberRow = { id: 'b-1', user_id: 'user-2', shop_id: 'shop-1' }
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [barberRow], rowCount: 1 } as any)

    await expect(deleteException('b-1', '2025-03-15', barberUser)).rejects.toThrow('FORBIDDEN')
  })

  it('calls DELETE with correct barberId and date', async () => {
    const barberRow = { id: 'b-1', user_id: 'user-1', shop_id: 'shop-1' }
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [barberRow], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    await deleteException('b-1', '2025-03-15', barberUser)
    const sql = vi.mocked(db.query).mock.calls[1][0] as string
    const params = vi.mocked(db.query).mock.calls[1][1] as unknown[]
    expect(sql).toContain('DELETE FROM schedule_exceptions')
    expect(params).toEqual(['b-1', '2025-03-15'])
  })

  it('allows owner of same shop to delete exception', async () => {
    const barberRow = { id: 'b-1', user_id: 'user-1', shop_id: 'shop-1' }
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [barberRow], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    await expect(deleteException('b-1', '2025-03-15', ownerUser)).resolves.toBeUndefined()
  })
})

describe('getAvailableSlots', () => {
  const barberId = 'barber-1'
  const date = '2025-03-17' // Monday (day_of_week = 1)
  const serviceId = 'svc-1'

  beforeEach(() => vi.clearAllMocks())

  it('generates cascade slots: 09:00-12:00 with 40min service → 4 slots', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [{ duration_minutes: 40 }], rowCount: 1 } as any)      // service
      .mockResolvedValueOnce({ rows: [{ start_time: '09:00', end_time: '12:00', is_working: true }], rowCount: 1 } as any) // schedule
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)   // no exception
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)   // no appointments

    const slots = await getAvailableSlots(barberId, date, serviceId)
    expect(slots).toHaveLength(4)
    expect(slots[0]).toBe('2025-03-17T09:00:00.000Z')
    expect(slots[1]).toBe('2025-03-17T09:40:00.000Z')
    expect(slots[2]).toBe('2025-03-17T10:20:00.000Z')
    expect(slots[3]).toBe('2025-03-17T11:00:00.000Z')
    // 11:40 would end at 12:20 > 12:00, excluded by while condition
  })

  it('returns [] when is_working = false', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [{ duration_minutes: 30 }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ start_time: '09:00', end_time: '18:00', is_working: false }], rowCount: 1 } as any)

    const slots = await getAvailableSlots(barberId, date, serviceId)
    expect(slots).toEqual([])
  })

  it('returns [] when no schedule entry for that day', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [{ duration_minutes: 30 }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // no schedule row

    const slots = await getAvailableSlots(barberId, date, serviceId)
    expect(slots).toEqual([])
  })

  it('returns [] when exception is_off = true', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [{ duration_minutes: 30 }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ start_time: '09:00', end_time: '18:00', is_working: true }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ is_off: true, start_time: null, end_time: null }], rowCount: 1 } as any)

    const slots = await getAvailableSlots(barberId, date, serviceId)
    expect(slots).toEqual([])
  })

  it('uses exception start/end time instead of schedule', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [{ duration_minutes: 60 }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ start_time: '09:00', end_time: '18:00', is_working: true }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ is_off: false, start_time: '14:00', end_time: '16:00' }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    const slots = await getAvailableSlots(barberId, date, serviceId)
    expect(slots).toHaveLength(2)
    expect(slots[0]).toBe('2025-03-17T14:00:00.000Z')
    expect(slots[1]).toBe('2025-03-17T15:00:00.000Z')
  })

  it('filters out slots overlapping with existing appointments', async () => {
    // 09:00-12:00 with 30min → normally 6 slots; appt at 09:30-10:00 blocks 09:30
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [{ duration_minutes: 30 }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ start_time: '09:00', end_time: '12:00', is_working: true }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
      .mockResolvedValueOnce({ rows: [
        { start_time: '2025-03-17T09:30:00.000Z', end_time: '2025-03-17T10:00:00.000Z' }
      ], rowCount: 1 } as any)

    const slots = await getAvailableSlots(barberId, date, serviceId)
    expect(slots).toHaveLength(5)
    expect(slots).not.toContain('2025-03-17T09:30:00.000Z')
    expect(slots).toContain('2025-03-17T09:00:00.000Z')
    expect(slots).toContain('2025-03-17T10:00:00.000Z')
  })

  it('slot starting exactly at appointment end is free (strict < boundary)', async () => {
    // appointment 09:00-09:30 → slot at 09:30 should be FREE (slotStart === apptEnd is not overlap)
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [{ duration_minutes: 30 }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ start_time: '09:00', end_time: '12:00', is_working: true }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
      .mockResolvedValueOnce({ rows: [
        { start_time: '2025-03-17T09:00:00.000Z', end_time: '2025-03-17T09:30:00.000Z' }
      ], rowCount: 1 } as any)

    const slots = await getAvailableSlots(barberId, date, serviceId)
    expect(slots).not.toContain('2025-03-17T09:00:00.000Z') // blocked
    expect(slots).toContain('2025-03-17T09:30:00.000Z')     // free (starts at exact end of appt)
  })

  it('slot ending exactly at appointment start is free (strict > boundary)', async () => {
    // appointment 09:30-10:00 → slot 09:00-09:30 should be FREE (slotEnd === apptStart is not overlap)
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [{ duration_minutes: 30 }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ start_time: '09:00', end_time: '12:00', is_working: true }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
      .mockResolvedValueOnce({ rows: [
        { start_time: '2025-03-17T09:30:00.000Z', end_time: '2025-03-17T10:00:00.000Z' }
      ], rowCount: 1 } as any)

    const slots = await getAvailableSlots(barberId, date, serviceId)
    expect(slots).toContain('2025-03-17T09:00:00.000Z')     // free (ends at exact start of appt)
    expect(slots).not.toContain('2025-03-17T09:30:00.000Z') // blocked
  })

  it('throws SERVICE_NOT_FOUND when service not found for barber', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
    await expect(getAvailableSlots(barberId, date, serviceId)).rejects.toThrow('SERVICE_NOT_FOUND')
  })
})
