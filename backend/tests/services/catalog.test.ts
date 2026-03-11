import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/db/pool', () => ({ db: { query: vi.fn() } }))

import { db } from '../../src/db/pool'
import { listCatalog, listBarberServices, addBarberService, updateBarberService, deleteBarberService } from '../../src/services/catalog'
import { AppError } from '../../src/lib/errors'
import type { OwnerBarberPayload } from '../../src/lib/jwt'

const ownerUser: OwnerBarberPayload = { userId: 'user-1', role: 'owner', shopId: 'shop-1' }
const barberUser: OwnerBarberPayload = { userId: 'user-2', role: 'barber', shopId: 'shop-1' }

describe('listCatalog', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns rows from query', async () => {
    const catalogRows = [
      { id: 'cat-1', name: 'Taglio', default_duration_minutes: 30, category: 'hair' },
      { id: 'cat-2', name: 'Barba', default_duration_minutes: 20, category: 'beard' },
    ]
    vi.mocked(db.query).mockResolvedValueOnce({ rows: catalogRows, rowCount: 2 } as any)

    const result = await listCatalog()

    expect(result).toEqual(catalogRows)
    expect(vi.mocked(db.query)).toHaveBeenCalledTimes(1)
  })

  it('returns empty array when no catalog items', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    const result = await listCatalog()

    expect(result).toEqual([])
  })

  it('queries service_catalog ordered by category and name', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    await listCatalog()

    const sql = vi.mocked(db.query).mock.calls[0][0] as string
    expect(sql).toContain('service_catalog')
    expect(sql).toContain('category')
    expect(sql).toContain('name')
  })
})

describe('listBarberServices', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns active services for a barber', async () => {
    const serviceRows = [
      { id: 'svc-1', barber_id: 'barber-1', service_catalog_id: 'cat-1', name: 'Taglio', duration_minutes: 30, price: '15.00', is_active: true },
    ]
    vi.mocked(db.query).mockResolvedValueOnce({ rows: serviceRows, rowCount: 1 } as any)

    const result = await listBarberServices('barber-1')

    expect(result).toEqual(serviceRows)
    expect(vi.mocked(db.query)).toHaveBeenCalledTimes(1)
  })

  it('filters by barber_id and is_active=true', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    await listBarberServices('barber-42')

    const sql = vi.mocked(db.query).mock.calls[0][0] as string
    const params = vi.mocked(db.query).mock.calls[0][1] as unknown[]
    expect(sql).toContain('barber_id')
    expect(sql).toContain('is_active')
    expect(params).toContain('barber-42')
  })

  it('returns empty array when barber has no active services', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    const result = await listBarberServices('barber-1')

    expect(result).toEqual([])
  })
})

describe('addBarberService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws BARBER_NOT_FOUND when barber does not exist', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    await expect(
      addBarberService('nonexistent', ownerUser, { name: 'Taglio', duration_minutes: 30 })
    ).rejects.toMatchObject({ code: 'BARBER_NOT_FOUND', statusCode: 404 })
  })

  it('throws FORBIDDEN when owner tries to add service to barber from different shop', async () => {
    const barberRow = { id: 'barber-1', user_id: 'user-2', shop_id: 'shop-other' }
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [barberRow], rowCount: 1 } as any)

    await expect(
      addBarberService('barber-1', ownerUser, { name: 'Taglio', duration_minutes: 30 })
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 })
  })

  it('throws FORBIDDEN when barber tries to add service to a different barber', async () => {
    const barberRow = { id: 'barber-1', user_id: 'user-other', shop_id: 'shop-1' }
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [barberRow], rowCount: 1 } as any)

    await expect(
      addBarberService('barber-1', barberUser, { name: 'Taglio', duration_minutes: 30 })
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 })
  })

  it('inserts service and returns inserted row', async () => {
    const barberRow = { id: 'barber-1', user_id: 'user-2', shop_id: 'shop-1' }
    const insertedRow = {
      id: 'svc-new',
      barber_id: 'barber-1',
      service_catalog_id: 'cat-1',
      name: 'Taglio',
      duration_minutes: 30,
      price: '15.00',
      is_active: true,
    }
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [barberRow], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [insertedRow], rowCount: 1 } as any)

    const result = await addBarberService('barber-1', ownerUser, {
      service_catalog_id: 'cat-1',
      name: 'Taglio',
      duration_minutes: 30,
      price: 15,
    })

    expect(result).toEqual(insertedRow)
    const insertCall = vi.mocked(db.query).mock.calls[1]
    const sql = insertCall[0] as string
    const params = insertCall[1] as unknown[]
    expect(sql).toContain('INSERT INTO barber_services')
    expect(sql).toContain('RETURNING')
    expect(params).toContain('barber-1')
    expect(params).toContain('cat-1')
    expect(params).toContain('Taglio')
    expect(params).toContain(30)
    expect(params).toContain(15)
  })

  it('passes null for optional fields when not provided', async () => {
    const barberRow = { id: 'barber-1', user_id: 'user-2', shop_id: 'shop-1' }
    const insertedRow = {
      id: 'svc-new',
      barber_id: 'barber-1',
      service_catalog_id: null,
      name: 'Custom',
      duration_minutes: 45,
      price: null,
      is_active: true,
    }
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [barberRow], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [insertedRow], rowCount: 1 } as any)

    const result = await addBarberService('barber-1', ownerUser, { name: 'Custom', duration_minutes: 45 })

    const insertCall = vi.mocked(db.query).mock.calls[1]
    const params = insertCall[1] as unknown[]
    expect(params).toContain(null)
    expect(result.service_catalog_id).toBeNull()
    expect(result.price).toBeNull()
  })

  it('succeeds for barber adding service to their own profile', async () => {
    const barberRow = { id: 'barber-1', user_id: 'user-2', shop_id: 'shop-1' }
    const insertedRow = { id: 'svc-new', barber_id: 'barber-1', service_catalog_id: null, name: 'Taglio', duration_minutes: 30, price: null, is_active: true }
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [barberRow], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [insertedRow], rowCount: 1 } as any)

    await expect(
      addBarberService('barber-1', barberUser, { name: 'Taglio', duration_minutes: 30 })
    ).resolves.toEqual(insertedRow)
  })
})

describe('updateBarberService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws BARBER_NOT_FOUND when barber does not exist', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    await expect(
      updateBarberService('nonexistent', 'svc-1', ownerUser, { name: 'New Name' })
    ).rejects.toMatchObject({ code: 'BARBER_NOT_FOUND', statusCode: 404 })
  })

  it('throws FORBIDDEN when owner from different shop', async () => {
    const barberRow = { id: 'barber-1', user_id: 'user-2', shop_id: 'shop-other' }
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [barberRow], rowCount: 1 } as any)

    await expect(
      updateBarberService('barber-1', 'svc-1', ownerUser, { name: 'New Name' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 })
  })

  it('throws FORBIDDEN when barber accessing another barber service', async () => {
    const barberRow = { id: 'barber-1', user_id: 'user-other', shop_id: 'shop-1' }
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [barberRow], rowCount: 1 } as any)

    await expect(
      updateBarberService('barber-1', 'svc-1', barberUser, { name: 'New Name' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 })
  })

  it('throws SERVICE_NOT_FOUND when service does not belong to barber', async () => {
    const barberRow = { id: 'barber-1', user_id: 'user-2', shop_id: 'shop-1' }
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [barberRow], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    await expect(
      updateBarberService('barber-1', 'svc-nonexistent', ownerUser, { name: 'New Name' })
    ).rejects.toMatchObject({ code: 'SERVICE_NOT_FOUND', statusCode: 404 })
  })

  it('returns early without UPDATE call when no fields provided', async () => {
    const barberRow = { id: 'barber-1', user_id: 'user-2', shop_id: 'shop-1' }
    const serviceRow = { id: 'svc-1' }
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [barberRow], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [serviceRow], rowCount: 1 } as any)

    await updateBarberService('barber-1', 'svc-1', ownerUser, {})

    expect(vi.mocked(db.query)).toHaveBeenCalledTimes(2)
  })

  it('calls UPDATE with only provided fields on success', async () => {
    const barberRow = { id: 'barber-1', user_id: 'user-2', shop_id: 'shop-1' }
    const serviceRow = { id: 'svc-1' }
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [barberRow], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [serviceRow], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)

    await updateBarberService('barber-1', 'svc-1', ownerUser, { name: 'New Name', duration_minutes: 45 })

    const updateCall = vi.mocked(db.query).mock.calls[2]
    const sql = updateCall[0] as string
    const params = updateCall[1] as unknown[]
    expect(sql).toContain('UPDATE barber_services SET')
    expect(sql).toContain('name')
    expect(sql).toContain('duration_minutes')
    expect(sql).not.toContain('price')
    expect(params).toContain('New Name')
    expect(params).toContain(45)
    expect(params).toContain('svc-1')
  })

  it('calls UPDATE with price when price is provided', async () => {
    const barberRow = { id: 'barber-1', user_id: 'user-2', shop_id: 'shop-1' }
    const serviceRow = { id: 'svc-1' }
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [barberRow], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [serviceRow], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)

    await updateBarberService('barber-1', 'svc-1', ownerUser, { price: 20 })

    const updateCall = vi.mocked(db.query).mock.calls[2]
    const sql = updateCall[0] as string
    const params = updateCall[1] as unknown[]
    expect(sql).toContain('price')
    expect(params).toContain(20)
  })
})

describe('deleteBarberService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws BARBER_NOT_FOUND when barber does not exist', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    await expect(
      deleteBarberService('nonexistent', 'svc-1', ownerUser)
    ).rejects.toMatchObject({ code: 'BARBER_NOT_FOUND', statusCode: 404 })
  })

  it('throws FORBIDDEN when owner from different shop', async () => {
    const barberRow = { id: 'barber-1', user_id: 'user-2', shop_id: 'shop-other' }
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [barberRow], rowCount: 1 } as any)

    await expect(
      deleteBarberService('barber-1', 'svc-1', ownerUser)
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 })
  })

  it('throws FORBIDDEN when barber accessing another barber service', async () => {
    const barberRow = { id: 'barber-1', user_id: 'user-other', shop_id: 'shop-1' }
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [barberRow], rowCount: 1 } as any)

    await expect(
      deleteBarberService('barber-1', 'svc-1', barberUser)
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 })
  })

  it('throws SERVICE_NOT_FOUND when service does not belong to barber', async () => {
    const barberRow = { id: 'barber-1', user_id: 'user-2', shop_id: 'shop-1' }
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [barberRow], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    await expect(
      deleteBarberService('barber-1', 'svc-nonexistent', ownerUser)
    ).rejects.toMatchObject({ code: 'SERVICE_NOT_FOUND', statusCode: 404 })
  })

  it('sets is_active=false instead of deleting row', async () => {
    const barberRow = { id: 'barber-1', user_id: 'user-2', shop_id: 'shop-1' }
    const serviceRow = { id: 'svc-1' }
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [barberRow], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [serviceRow], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)

    await deleteBarberService('barber-1', 'svc-1', ownerUser)

    const deactivateCall = vi.mocked(db.query).mock.calls[2]
    const sql = deactivateCall[0] as string
    const params = deactivateCall[1] as unknown[]
    expect(sql).toContain('UPDATE barber_services SET is_active = false')
    expect(sql).not.toContain('DELETE FROM')
    expect(params).toContain('svc-1')
  })

  it('succeeds for barber deleting their own service', async () => {
    const barberRow = { id: 'barber-1', user_id: 'user-2', shop_id: 'shop-1' }
    const serviceRow = { id: 'svc-1' }
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [barberRow], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [serviceRow], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)

    await expect(
      deleteBarberService('barber-1', 'svc-1', barberUser)
    ).resolves.toBeUndefined()
  })
})
