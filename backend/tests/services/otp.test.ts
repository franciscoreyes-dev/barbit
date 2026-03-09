import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'crypto'

vi.mock('../../src/db/pool', () => ({
  db: {
    query: vi.fn(),
    connect: vi.fn(),
  },
}))

vi.mock('twilio', () => ({
  default: vi.fn().mockReturnValue({
    messages: {
      create: vi.fn().mockResolvedValue({ sid: 'SM123' }),
    },
  }),
}))

import twilio from 'twilio'
import { db } from '../../src/db/pool'
import { verifyToken } from '../../src/lib/jwt'
import { sendOtp, verifyOtp } from '../../src/services/otp'

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

describe('sendOtp', () => {
  beforeEach(() => vi.clearAllMocks())

  it('invalidates prior codes, inserts new OTP hash, and calls Twilio', async () => {
    vi.mocked(db.query).mockResolvedValue({ rows: [], rowCount: 0 } as any)

    await sendOtp('+393331234567')

    // First query: invalidate prior codes
    expect(vi.mocked(db.query).mock.calls[0][0]).toContain('UPDATE otp_codes SET used_at')

    // Second query: insert new OTP
    expect(vi.mocked(db.query).mock.calls[1][0]).toContain('INSERT INTO otp_codes')
    // The stored value should be a SHA-256 hash (64 hex chars), not the raw code
    const storedCode = vi.mocked(db.query).mock.calls[1][1]?.[1] as string
    expect(storedCode).toHaveLength(64) // SHA-256 hex = 64 chars
    expect(storedCode).toMatch(/^[a-f0-9]+$/)

    // Twilio was called with the correct phone number
    const twilioInstance = vi.mocked(twilio).mock.results[0].value
    expect(twilioInstance.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ to: '+393331234567' })
    )
  })
})

describe('verifyOtp', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns customer JWT with correct payload', async () => {
    const futureDate = new Date(Date.now() + 60000)
    const otpRow = { id: 'otp-1', expires_at: futureDate }
    const customerRow = { id: 'customer-1', shop_id: 'shop-1' }

    vi.mocked(db.query).mockResolvedValueOnce({ rows: [otpRow], rowCount: 1 } as any)

    const mockClient = makeMockClient([
      { rows: [], rowCount: 0 },             // BEGIN
      { rows: [], rowCount: 0 },             // UPDATE used_at
      { rows: [customerRow], rowCount: 1 },  // INSERT customer
      { rows: [], rowCount: 0 },             // COMMIT
    ])
    vi.mocked(db.connect).mockResolvedValue(mockClient as any)

    const result = await verifyOtp('+393331234567', '123456', 'shop-1')

    expect(result.token).toBeDefined()
    const payload = verifyToken(result.token)
    expect(payload).toMatchObject({ customerId: 'customer-1', shopId: 'shop-1' })
    expect(mockClient.release).toHaveBeenCalled()
  })

  it('throws OTP_INVALID if code not found', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
    await expect(verifyOtp('+393331234567', '000000', 'shop-1')).rejects.toThrow('OTP_INVALID')
  })

  it('throws OTP_EXPIRED if expires_at is in the past', async () => {
    const expired = { id: 'otp-1', expires_at: new Date(Date.now() - 1000) }
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [expired], rowCount: 1 } as any)
    await expect(verifyOtp('+393331234567', '123456', 'shop-1')).rejects.toThrow('OTP_EXPIRED')
  })

  it('looks up OTP by SHA-256 hash of the submitted code', async () => {
    const futureDate = new Date(Date.now() + 60000)
    const otpRow = { id: 'otp-1', expires_at: futureDate }
    const customerRow = { id: 'customer-1', shop_id: 'shop-1' }

    vi.mocked(db.query).mockResolvedValueOnce({ rows: [otpRow], rowCount: 1 } as any)

    const mockClient = makeMockClient([
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: 0 },
      { rows: [customerRow], rowCount: 1 },
      { rows: [], rowCount: 0 },
    ])
    vi.mocked(db.connect).mockResolvedValue(mockClient as any)

    await verifyOtp('+393331234567', '123456', 'shop-1')

    const expectedHash = createHash('sha256').update('123456').digest('hex')
    const dbCallArgs = vi.mocked(db.query).mock.calls[0][1] as string[]
    expect(dbCallArgs[1]).toBe(expectedHash)
  })
})
