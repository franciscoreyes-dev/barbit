import { FastifyRequest, FastifyReply } from 'fastify'
import { verifyToken, CustomerPayload } from './jwt'

declare module 'fastify' {
  interface FastifyRequest {
    customer?: CustomerPayload
  }
}

export async function requireCustomer(request: FastifyRequest, reply: FastifyReply) {
  const auth = request.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    reply.code(401).send({ code: 'UNAUTHORIZED' })
    return
  }
  try {
    const token = auth.slice(7)
    const payload = verifyToken(token)
    if (!('customerId' in payload)) {
      reply.code(401).send({ code: 'UNAUTHORIZED' })
      return
    }
    request.customer = payload as CustomerPayload
  } catch {
    reply.code(401).send({ code: 'UNAUTHORIZED' })
  }
}
