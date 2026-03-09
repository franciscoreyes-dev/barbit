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
  },
}))

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ id: 'email-1' }),
    },
  })),
}))

import { db } from '../../src/db/pool'
import bcrypt from 'bcrypt'
import { Resend } from 'resend'
import { sendInvite, getInviteInfo, acceptInvite } from '../../src/services/invite'
import { verifyToken } from '../../src/lib/jwt'

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

describe('sendInvite', () => {
  beforeEach(() => vi.clearAllMocks())

  it('saves invite token and sends email via Resend', async () => {
    const shopRow = { id: 'shop-1', name: 'Test Shop' }
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [shopRow], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

    await sendInvite('barber@test.com', 'shop-1')

    expect(vi.mocked(db.query).mock.calls[1][0]).toContain('INSERT INTO invite_tokens')
    const resendInstance = vi.mocked(Resend).mock.results[0].value
    expect(resendInstance.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'barber@test.com' })
    )
  })
})

describe('getInviteInfo', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns email and shopName for valid token', async () => {
    const tokenRow = {
      email: 'barber@test.com',
      shop_name: 'Test Shop',
      expires_at: new Date(Date.now() + 86400000),
      used_at: null,
    }
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [tokenRow], rowCount: 1 } as any)

    const result = await getInviteInfo('valid-token')
    expect(result).toEqual({ email: 'barber@test.com', shopName: 'Test Shop' })
  })

  it('throws INVITE_INVALID if token not found', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
    await expect(getInviteInfo('bad-token')).rejects.toThrow('INVITE_INVALID')
  })

  it('throws INVITE_EXPIRED if token expired', async () => {
    const expired = {
      email: 'b@test.com',
      shop_name: 'Shop',
      expires_at: new Date(Date.now() - 1000),
      used_at: null,
    }
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [expired], rowCount: 1 } as any)
    await expect(getInviteInfo('expired-token')).rejects.toThrow('INVITE_EXPIRED')
  })

  it('throws INVITE_USED if already used', async () => {
    const used = {
      email: 'b@test.com',
      shop_name: 'Shop',
      expires_at: new Date(Date.now() + 86400000),
      used_at: new Date(),
    }
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [used], rowCount: 1 } as any)
    await expect(getInviteInfo('used-token')).rejects.toThrow('INVITE_USED')
  })
})

describe('acceptInvite', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates user + barber in transaction, marks token used, returns JWT with correct payload', async () => {
    const tokenRow = {
      id: 'token-1',
      email: 'barber@test.com',
      shop_id: 'shop-1',
      expires_at: new Date(Date.now() + 86400000),
      used_at: null,
    }
    const userRow = { id: 'user-1', role: 'barber', shop_id: 'shop-1' }

    vi.mocked(db.query).mockResolvedValueOnce({ rows: [tokenRow], rowCount: 1 } as any)

    const mockClient = makeMockClient([
      { rows: [], rowCount: 0 },          // BEGIN
      { rows: [userRow], rowCount: 1 },   // INSERT users
      { rows: [], rowCount: 0 },          // INSERT barbers
      { rows: [], rowCount: 0 },          // UPDATE invite_tokens used_at
      { rows: [], rowCount: 0 },          // COMMIT
    ])
    vi.mocked(db.connect).mockResolvedValue(mockClient as any)

    const result = await acceptInvite('valid-token', 'Mario Rossi', 'password123')

    expect(result.token).toBeDefined()
    const payload = verifyToken(result.token)
    expect(payload).toMatchObject({ userId: 'user-1', role: 'barber', shopId: 'shop-1' })
    expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12)
    expect(mockClient.release).toHaveBeenCalled()
  })

  it('throws INVITE_INVALID if token not found', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
    await expect(acceptInvite('bad-token', 'Mario', 'pass')).rejects.toThrow('INVITE_INVALID')
  })

  it('throws INVITE_USED if token already used', async () => {
    const usedToken = {
      id: 'token-1',
      email: 'b@test.com',
      shop_id: 'shop-1',
      expires_at: new Date(Date.now() + 86400000),
      used_at: new Date(),
    }
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [usedToken], rowCount: 1 } as any)
    await expect(acceptInvite('used-token', 'Mario', 'pass')).rejects.toThrow('INVITE_USED')
  })

  it('throws INVITE_EXPIRED if token expired', async () => {
    const expiredToken = {
      id: 'token-1',
      email: 'b@test.com',
      shop_id: 'shop-1',
      expires_at: new Date(Date.now() - 1000),
      used_at: null,
    }
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [expiredToken], rowCount: 1 } as any)
    await expect(acceptInvite('expired-token', 'Mario', 'pass')).rejects.toThrow('INVITE_EXPIRED')
  })
})
