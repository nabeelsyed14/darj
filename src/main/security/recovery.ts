import crypto from 'crypto'
import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 10
const KEY_LENGTH = 16

export function generateRecoveryKey(): string {
  const bytes = crypto.randomBytes(KEY_LENGTH)
  return bytes.toString('hex').toUpperCase().match(/.{4}/g)!.join('-')
}

export function hashRecoveryKey(key: string): string {
  return bcrypt.hashSync(key, SALT_ROUNDS)
}

export function verifyRecoveryKey(key: string, hash: string): boolean {
  return bcrypt.compareSync(key, hash)
}
