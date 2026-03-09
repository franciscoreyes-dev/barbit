import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/db/pool', () => ({
  db: { query: vi.fn() },
}))

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed_password'),
    compare: vi.fn(),
  },
}))

vi.mock('slugify', () => ({
  default: vi.fn().mockReturnValue('test-shop'),
}))

import { db } from '../../src/db/pool'
import bcrypt from 'bcrypt'
import { registerOwner, login } from '../../src/services/auth'

describe('registerOwner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates shop, user, and barber, returns JWT', async () => {
    const shopRow = { id: 'shop-1', name: 'Test Shop', slug: 'test-shop' }
    const userRow = { id: 'user-1', email: 'owner@test.com', role: 'owner', shop_id: 'shop-1' }
    const barberRow = { id: 'barber-1', user_id: 'user-1', shop_id: 'shop-1' }

    const mockQuery = vi.mocked(db.query)
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)       // email uniqueness check
      .mockResolvedValueOnce({ rows: [shopRow], rowCount: 1 } as any) // insert shop
      .mockResolvedValueOnce({ rows: [userRow], rowCount: 1 } as any) // insert user
      .mockResolvedValueOnce({ rows: [barberRow], rowCount: 1 } as any) // insert barber

    const result = await registerOwner({
      email: 'owner@test.com',
      password: 'password123',
      shopName: 'Test Shop',
      shopCity: 'Roma',
    })

    expect(result.token).toBeDefined()
    expect(typeof result.token).toBe('string')
    expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12)
    expect(mockQuery).toHaveBeenCalledTimes(4)
  })

  it('throws EMAIL_TAKEN if email already exists', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [{ id: 'existing-user' }],
      rowCount: 1,
    } as any)

    await expect(
      registerOwner({ email: 'taken@test.com', password: 'pass', shopName: 'Shop', shopCity: 'Roma' })
    ).rejects.toThrow('EMAIL_TAKEN')
  })
})

describe('login', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns JWT on valid credentials', async () => {
    const userRow = {
      id: 'user-1',
      email: 'owner@test.com',
      password_hash: 'hashed',
      role: 'owner',
      shop_id: 'shop-1',
      is_active: true,
    }
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [userRow], rowCount: 1 } as any)
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never)

    const result = await login('owner@test.com', 'password123')
    expect(result.token).toBeDefined()
  })

  it('throws INVALID_CREDENTIALS if user not found', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
    await expect(login('nobody@test.com', 'pass')).rejects.toThrow('INVALID_CREDENTIALS')
  })

  it('throws INVALID_CREDENTIALS if password wrong', async () => {
    const userRow = { id: 'u1', password_hash: 'hashed', role: 'owner', shop_id: 's1', is_active: true }
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [userRow], rowCount: 1 } as any)
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as never)
    await expect(login('owner@test.com', 'wrongpass')).rejects.toThrow('INVALID_CREDENTIALS')
  })

  it('throws ACCOUNT_INACTIVE if is_active is false', async () => {
    const userRow = { id: 'u1', password_hash: 'hashed', role: 'barber', shop_id: 's1', is_active: false }
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [userRow], rowCount: 1 } as any)
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never)
    await expect(login('barber@test.com', 'pass')).rejects.toThrow('ACCOUNT_INACTIVE')
  })
})
