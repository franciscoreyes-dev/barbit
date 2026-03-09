import { createHash } from 'crypto'
import { randomInt } from 'crypto'
import twilio from 'twilio'
import { db } from '../db/pool'
import { AppError } from '../lib/errors'
import { signToken, CustomerPayload } from '../lib/jwt'

function generateCode(): string {
  return randomInt(100000, 1000000).toString()
}

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

function getTwilioClient() {
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
}

export async function sendOtp(phone: string): Promise<void> {
  const code = generateCode()
  const codeHash = hashCode(code)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  await db.query(
    `UPDATE otp_codes SET used_at = now()
     WHERE phone = $1 AND used_at IS NULL AND expires_at > now()`,
    [phone]
  )

  await db.query(
    `INSERT INTO otp_codes (phone, code, expires_at) VALUES ($1, $2, $3)`,
    [phone, codeHash, expiresAt]
  )

  const client = getTwilioClient()
  await client.messages.create({
    body: `Il tuo codice Barbit: ${code}`,
    from: process.env.TWILIO_FROM_NUMBER,
    to: phone,
  })
}

export async function verifyOtp(phone: string, code: string, shopId: string): Promise<{ token: string }> {
  const codeHash = hashCode(code)

  const res = await db.query(
    `SELECT id, expires_at FROM otp_codes
     WHERE phone = $1 AND code = $2 AND used_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [phone, codeHash]
  )

  const otp = res.rows[0]
  if (!otp) throw new AppError('OTP_INVALID', 400)
  if (new Date(otp.expires_at) < new Date()) throw new AppError('OTP_EXPIRED', 400)

  const client = await db.connect()
  try {
    await client.query('BEGIN')
    await client.query(`UPDATE otp_codes SET used_at = now() WHERE id = $1`, [otp.id])
    const customerRes = await client.query(
      `INSERT INTO customers (phone, shop_id) VALUES ($1, $2)
       ON CONFLICT (phone, shop_id) DO UPDATE SET phone = EXCLUDED.phone
       RETURNING id, shop_id`,
      [phone, shopId]
    )
    await client.query('COMMIT')

    const customer = customerRes.rows[0]
    const payload: CustomerPayload = { customerId: customer.id, shopId: customer.shop_id }
    const token = signToken(payload, '7d')
    return { token }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
