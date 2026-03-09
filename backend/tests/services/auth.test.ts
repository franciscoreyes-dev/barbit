import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/db/pool', () => ({
  db: {
    query: vi.fn(),
    connect: vi.fn(),
  },
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

describe('registerOwner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates shop, user, and barber in a transaction, returns JWT', async () => {
    const shopRow = { id: 'shop-1' }
    const userRow = { id: 'user-1', role: 'owner', shop_id: 'shop-1' }

    // db.query calls: email check, slug check
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // email check
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // slug check

    const mockClient = makeMockClient([
      { rows: [], rowCount: 0 },          // BEGIN
      { rows: [shopRow], rowCount: 1 },   // INSERT shops
      { rows: [userRow], rowCount: 1 },   // INSERT users
      { rows: [], rowCount: 0 },          // INSERT barbers
      { rows: [], rowCount: 0 },          // COMMIT
    ])
    vi.mocked(db.connect).mockResolvedValue(mockClient as any)

    const result = await registerOwner({
      email: 'owner@test.com',
      password: 'password123',
      shopName: 'Test Shop',
      shopCity: 'Roma',
      ownerName: 'Mario Rossi',
    })

    expect(result.token).toBeDefined()
    expect(typeof result.token).toBe('string')
    expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12)
    expect(mockClient.release).toHaveBeenCalled()
  })

  it('throws EMAIL_TAKEN if email already exists', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [{ id: 'existing-user' }],
      rowCount: 1,
    } as any)

    await expect(
      registerOwner({ email: 'taken@test.com', password: 'pass', shopName: 'Shop', shopCity: 'Roma', ownerName: 'Mario' })
    ).rejects.toThrow('EMAIL_TAKEN')
  })

  it('throws SLUG_TAKEN if slug already exists', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // email check passes
      .mockResolvedValueOnce({ rows: [{ id: 'existing-shop' }], rowCount: 1 } as any) // slug check fails

    await expect(
      registerOwner({ email: 'new@test.com', password: 'pass', shopName: 'Taken Shop', shopCity: 'Roma', ownerName: 'Mario' })
    ).rejects.toThrow('SLUG_TAKEN')
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

  it('throws ACCOUNT_INACTIVE before checking password', async () => {
    const userRow = { id: 'u1', password_hash: 'hashed', role: 'barber', shop_id: 's1', is_active: false }
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [userRow], rowCount: 1 } as any)

    await expect(login('barber@test.com', 'anypass')).rejects.toThrow('ACCOUNT_INACTIVE')
    expect(bcrypt.compare).not.toHaveBeenCalled()
  })

  it('throws INVALID_CREDENTIALS if password wrong', async () => {
    const userRow = { id: 'u1', password_hash: 'hashed', role: 'owner', shop_id: 's1', is_active: true }
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [userRow], rowCount: 1 } as any)
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as never)
    await expect(login('owner@test.com', 'wrongpass')).rejects.toThrow('INVALID_CREDENTIALS')
  })
})
