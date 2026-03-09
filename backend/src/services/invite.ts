import { Resend } from 'resend'
import { randomUUID } from 'crypto'
import bcrypt from 'bcrypt'
import { db } from '../db/pool'
import { AppError } from '../lib/errors'
import { signToken } from '../lib/jwt'

type ResendFactory = (key: string | undefined) => InstanceType<typeof Resend>

function getResend(): InstanceType<typeof Resend> {
  return (Resend as unknown as ResendFactory)(process.env.RESEND_API_KEY)
}

export async function sendInvite(email: string, shopId: string): Promise<void> {
  const shopRes = await db.query('SELECT id, name FROM shops WHERE id = $1', [shopId])
  const shop = shopRes.rows[0]

  const token = randomUUID()
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000)

  await db.query(
    `INSERT INTO invite_tokens (email, shop_id, token, expires_at) VALUES ($1, $2, $3, $4)`,
    [email, shopId, token, expiresAt]
  )

  const resend = getResend()
  const inviteUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/invite/${token}`
  await resend.emails.send({
    from: 'Barbit <noreply@barbit.app>',
    to: email,
    subject: `Sei stato invitato a unirti a ${shop.name} su Barbit`,
    html: `<p>Clicca <a href="${inviteUrl}">qui</a> per accettare l'invito.</p>`,
  })
}

export async function getInviteInfo(token: string) {
  const res = await db.query(
    `SELECT it.email, s.name AS shop_name, it.expires_at, it.used_at
     FROM invite_tokens it
     JOIN shops s ON s.id = it.shop_id
     WHERE it.token = $1`,
    [token]
  )

  const row = res.rows[0]
  if (!row) throw new AppError('INVITE_INVALID', 404)
  if (row.used_at) throw new AppError('INVITE_USED', 409)
  if (new Date(row.expires_at) < new Date()) throw new AppError('INVITE_EXPIRED', 410)

  return { email: row.email as string, shopName: row.shop_name as string }
}

export async function acceptInvite(token: string, name: string, password: string): Promise<{ token: string }> {
  const res = await db.query(
    `SELECT id, email, shop_id, expires_at, used_at FROM invite_tokens WHERE token = $1`,
    [token]
  )

  const invite = res.rows[0]
  if (!invite) throw new AppError('INVITE_INVALID', 404)
  if (invite.used_at) throw new AppError('INVITE_USED', 409)
  if (new Date(invite.expires_at) < new Date()) throw new AppError('INVITE_EXPIRED', 410)

  const passwordHash = await bcrypt.hash(password, 12)

  const client = await db.connect()
  try {
    await client.query('BEGIN')

    const userRes = await client.query(
      `INSERT INTO users (email, password_hash, role, shop_id, is_active)
       VALUES ($1, $2, 'barber', $3, true) RETURNING id, role, shop_id`,
      [invite.email, passwordHash, invite.shop_id]
    )
    const user = userRes.rows[0]

    await client.query(
      `INSERT INTO barbers (user_id, shop_id, name) VALUES ($1, $2, $3)`,
      [user.id, invite.shop_id, name]
    )

    await client.query(
      `UPDATE invite_tokens SET used_at = now() WHERE id = $1`,
      [invite.id]
    )

    await client.query('COMMIT')

    const jwtToken = signToken({ userId: user.id, role: user.role, shopId: user.shop_id })
    return { token: jwtToken }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
