import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/db/pool', () => ({
  db: {
    query: vi.fn(),
  },
}))

vi.mock('slugify', () => ({
  default: vi.fn().mockReturnValue('test-shop'),
}))

import { db } from '../../src/db/pool'
import { searchShops, getShopBySlug, updateShop } from '../../src/services/shop'
import { AppError } from '../../src/lib/errors'
import type { OwnerBarberPayload } from '../../src/lib/jwt'

const ownerUser: OwnerBarberPayload = { userId: 'user-1', role: 'owner', shopId: 'shop-1' }

describe('searchShops', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns rows when matching shops found', async () => {
    const shopRow = { id: 'shop-1', name: 'Test Shop', slug: 'test-shop', city: 'Roma', address: 'Via Roma 1' }
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [shopRow], rowCount: 1 } as any)

    const result = await searchShops('Test')
    expect(result).toEqual([shopRow])
  })

  it('passes %q% pattern to ILIKE when q provided', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    await searchShops('Mario')

    const call = vi.mocked(db.query).mock.calls[0]
    expect(call[1]).toContain('%Mario%')
  })

  it('returns results with no filter when no params provided', async () => {
    const shops = [
      { id: 'shop-1', name: 'Alpha', slug: 'alpha', city: 'Roma', address: null },
      { id: 'shop-2', name: 'Beta', slug: 'beta', city: 'Milano', address: null },
    ]
    vi.mocked(db.query).mockResolvedValueOnce({ rows: shops, rowCount: 2 } as any)

    const result = await searchShops()
    expect(result).toHaveLength(2)
  })

  it('does NOT add WHERE clause when no params provided', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    await searchShops()

    const sql = vi.mocked(db.query).mock.calls[0][0] as string
    expect(sql).not.toContain('WHERE')
  })

  it('passes %city% pattern to ILIKE when city provided', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    await searchShops(undefined, 'Roma')

    const call = vi.mocked(db.query).mock.calls[0]
    expect(call[1]).toContain('%Roma%')
  })
})

describe('getShopBySlug', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws SHOP_NOT_FOUND when shop query returns no rows', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    await expect(getShopBySlug('nonexistent')).rejects.toThrow('SHOP_NOT_FOUND')
  })

  it('throws SHOP_NOT_FOUND with 404 status', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    await expect(getShopBySlug('nonexistent')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('returns shop with barbers and services', async () => {
    const shopRow = {
      id: 'shop-1', name: 'Barberino', slug: 'barberino', city: 'Roma',
      address: 'Via Roma 1', phone: '06123456', email: 'info@barberino.it', timezone: 'Europe/Rome',
    }
    const barberRows = [{ id: 'barber-1', name: 'Mario', avatar_url: null }]
    const serviceRows = [{ id: 'svc-1', name: 'Taglio', duration_minutes: 30, price: '15.00' }]

    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [shopRow], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: barberRows, rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: serviceRows, rowCount: 1 } as any)

    const result = await getShopBySlug('barberino')

    expect(result.id).toBe('shop-1')
    expect(result.name).toBe('Barberino')
    expect(result.barbers).toHaveLength(1)
    expect(result.barbers[0].id).toBe('barber-1')
    expect(result.barbers[0].services).toHaveLength(1)
    expect(result.barbers[0].services[0].name).toBe('Taglio')
  })

  it('barbers with no services return empty services array', async () => {
    const shopRow = {
      id: 'shop-1', name: 'Barberino', slug: 'barberino', city: 'Roma',
      address: null, phone: null, email: null, timezone: 'Europe/Rome',
    }
    const barberRows = [{ id: 'barber-1', name: 'Mario', avatar_url: null }]

    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [shopRow], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: barberRows, rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    const result = await getShopBySlug('barberino')

    expect(result.barbers[0].services).toEqual([])
  })
})

describe('updateShop', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws FORBIDDEN when user.shopId !== shopId', async () => {
    await expect(
      updateShop('other-shop', ownerUser, { name: 'New Name' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 })
  })

  it('returns early without DB call when no fields provided', async () => {
    await updateShop('shop-1', ownerUser, {})

    expect(vi.mocked(db.query)).not.toHaveBeenCalled()
  })

  it('throws SLUG_TAKEN when new name generates a slug that exists in another shop', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [{ id: 'other-shop' }], rowCount: 1 } as any)

    await expect(
      updateShop('shop-1', ownerUser, { name: 'Test Shop' })
    ).rejects.toMatchObject({ code: 'SLUG_TAKEN', statusCode: 409 })
  })

  it('updates only provided fields and calls UPDATE', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)

    await updateShop('shop-1', ownerUser, { name: 'Test Shop', city: 'Milano' })

    const updateCall = vi.mocked(db.query).mock.calls[1]
    const sql = updateCall[0] as string
    expect(sql).toContain('UPDATE shops SET')
    expect(sql).toContain('name')
    expect(sql).toContain('city')
  })

  it('includes slug in UPDATE when name is provided', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)

    await updateShop('shop-1', ownerUser, { name: 'Test Shop' })

    const updateCall = vi.mocked(db.query).mock.calls[1]
    const sql = updateCall[0] as string
    expect(sql).toContain('slug')
  })

  it('updates address, phone, email, timezone without slug check when name not provided', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)

    await updateShop('shop-1', ownerUser, { address: 'Via Milano 2', phone: '0612345' })

    expect(vi.mocked(db.query)).toHaveBeenCalledTimes(1)
    const sql = vi.mocked(db.query).mock.calls[0][0] as string
    expect(sql).toContain('UPDATE shops SET')
    expect(sql).not.toContain('WHERE slug')
  })
})
