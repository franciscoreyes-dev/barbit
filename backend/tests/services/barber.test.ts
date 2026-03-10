import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/db/pool', () => ({ db: { query: vi.fn() } }))

import { db } from '../../src/db/pool'
import { listBarbers, updateBarber, deactivateBarber } from '../../src/services/barber'
import { AppError } from '../../src/lib/errors'
import type { OwnerBarberPayload } from '../../src/lib/jwt'

const ownerUser: OwnerBarberPayload = { userId: 'user-1', role: 'owner', shopId: 'shop-1' }
const barberUser: OwnerBarberPayload = { userId: 'user-2', role: 'barber', shopId: 'shop-1' }

describe('listBarbers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns barbers with embedded services', async () => {
    const barberRows = [
      { id: 'barber-1', name: 'Mario', avatar_url: null },
      { id: 'barber-2', name: 'Luigi', avatar_url: 'https://example.com/luigi.jpg' },
    ]
    const servicesBarber1 = [{ id: 'svc-1', name: 'Taglio', duration_minutes: 30, price: '15.00' }]
    const servicesBarber2 = [
      { id: 'svc-2', name: 'Barba', duration_minutes: 20, price: '10.00' },
      { id: 'svc-3', name: 'Taglio e Barba', duration_minutes: 45, price: '20.00' },
    ]

    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: barberRows, rowCount: 2 } as any)
      .mockResolvedValueOnce({ rows: servicesBarber1, rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: servicesBarber2, rowCount: 2 } as any)

    const result = await listBarbers('shop-1')

    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('barber-1')
    expect(result[0].services).toEqual(servicesBarber1)
    expect(result[1].id).toBe('barber-2')
    expect(result[1].services).toHaveLength(2)
  })

  it('returns empty array when no barbers found', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    const result = await listBarbers('shop-1')

    expect(result).toEqual([])
    expect(vi.mocked(db.query)).toHaveBeenCalledTimes(1)
  })

  it('returns barbers with empty services array when barber has no services', async () => {
    const barberRows = [{ id: 'barber-1', name: 'Mario', avatar_url: null }]

    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: barberRows, rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    const result = await listBarbers('shop-1')

    expect(result[0].services).toEqual([])
  })

  it('queries barbers filtered by shop_id and is_active', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    await listBarbers('shop-42')

    const sql = vi.mocked(db.query).mock.calls[0][0] as string
    const params = vi.mocked(db.query).mock.calls[0][1] as unknown[]
    expect(sql).toContain('shop_id')
    expect(sql).toContain('is_active')
    expect(params).toContain('shop-42')
  })
})

describe('updateBarber', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws BARBER_NOT_FOUND when barber does not exist', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    await expect(
      updateBarber('nonexistent', ownerUser, { name: 'New Name' })
    ).rejects.toMatchObject({ code: 'BARBER_NOT_FOUND', statusCode: 404 })
  })

  it('throws FORBIDDEN when owner tries to update barber from different shop', async () => {
    const barberRow = { id: 'barber-1', user_id: 'user-2', shop_id: 'shop-other', name: 'Mario', avatar_url: null, is_active: true }
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [barberRow], rowCount: 1 } as any)

    await expect(
      updateBarber('barber-1', ownerUser, { name: 'New Name' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 })
  })

  it('throws FORBIDDEN when barber tries to update a different barber', async () => {
    const barberRow = { id: 'barber-1', user_id: 'user-other', shop_id: 'shop-1', name: 'Mario', avatar_url: null, is_active: true }
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [barberRow], rowCount: 1 } as any)

    await expect(
      updateBarber('barber-1', barberUser, { name: 'New Name' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 })
  })

  it('succeeds for owner updating barber in their own shop', async () => {
    const barberRow = { id: 'barber-1', user_id: 'user-2', shop_id: 'shop-1', name: 'Mario', avatar_url: null, is_active: true }
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [barberRow], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)

    await expect(
      updateBarber('barber-1', ownerUser, { name: 'New Name' })
    ).resolves.toBeUndefined()

    const updateCall = vi.mocked(db.query).mock.calls[1]
    const sql = updateCall[0] as string
    expect(sql).toContain('UPDATE barbers SET')
  })

  it('succeeds for barber updating their own data', async () => {
    const barberRow = { id: 'barber-1', user_id: 'user-2', shop_id: 'shop-1', name: 'Mario', avatar_url: null, is_active: true }
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [barberRow], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)

    await expect(
      updateBarber('barber-1', barberUser, { name: 'New Name' })
    ).resolves.toBeUndefined()
  })

  it('returns early without DB UPDATE call when no fields provided', async () => {
    const barberRow = { id: 'barber-1', user_id: 'user-2', shop_id: 'shop-1', name: 'Mario', avatar_url: null, is_active: true }
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [barberRow], rowCount: 1 } as any)

    await updateBarber('barber-1', ownerUser, {})

    expect(vi.mocked(db.query)).toHaveBeenCalledTimes(1)
  })

  it('builds SET clause with only provided fields', async () => {
    const barberRow = { id: 'barber-1', user_id: 'user-2', shop_id: 'shop-1', name: 'Mario', avatar_url: null, is_active: true }
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [barberRow], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)

    await updateBarber('barber-1', ownerUser, { name: 'Luigi', is_active: false })

    const updateCall = vi.mocked(db.query).mock.calls[1]
    const sql = updateCall[0] as string
    expect(sql).toContain('name')
    expect(sql).toContain('is_active')
    expect(sql).not.toContain('avatar_url')
  })
})

describe('deactivateBarber', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws BARBER_NOT_FOUND when barber does not exist', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    await expect(
      deactivateBarber('nonexistent', ownerUser)
    ).rejects.toMatchObject({ code: 'BARBER_NOT_FOUND', statusCode: 404 })
  })

  it('throws FORBIDDEN when called with barber role', async () => {
    const barberRow = { id: 'barber-1', user_id: 'user-2', shop_id: 'shop-1', name: 'Mario', avatar_url: null, is_active: true }
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [barberRow], rowCount: 1 } as any)

    await expect(
      deactivateBarber('barber-1', barberUser)
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 })
  })

  it('throws FORBIDDEN when owner from different shop', async () => {
    const barberRow = { id: 'barber-1', user_id: 'user-2', shop_id: 'shop-other', name: 'Mario', avatar_url: null, is_active: true }
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [barberRow], rowCount: 1 } as any)

    await expect(
      deactivateBarber('barber-1', ownerUser)
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 })
  })

  it('calls UPDATE setting is_active = false on success', async () => {
    const barberRow = { id: 'barber-1', user_id: 'user-2', shop_id: 'shop-1', name: 'Mario', avatar_url: null, is_active: true }
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [barberRow], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)

    await deactivateBarber('barber-1', ownerUser)

    const updateCall = vi.mocked(db.query).mock.calls[1]
    const sql = updateCall[0] as string
    const params = updateCall[1] as unknown[]
    expect(sql).toContain('UPDATE barbers SET is_active = false')
    expect(params).toContain('barber-1')
  })
})
