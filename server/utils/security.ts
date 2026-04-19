import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const digest = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${digest}`
}

export function verifyPassword(password: string, hash: string): boolean {
  const [salt, digest] = hash.split(':')
  if (!salt || !digest) {
    return false
  }

  const supplied = scryptSync(password, salt, 64)
  const saved = Buffer.from(digest, 'hex')

  if (saved.length !== supplied.length) {
    return false
  }

  return timingSafeEqual(saved, supplied)
}

export function isStrongPassword(password: string): boolean {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/.test(password)
}
