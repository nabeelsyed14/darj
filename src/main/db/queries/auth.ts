import { queryOne, queryRun } from '../connection'
import { hashPassword, verifyPassword } from '../../security/password'
import { generateRecoveryKey, hashRecoveryKey, verifyRecoveryKey } from '../../security/recovery'

export function createUser(schoolId: number, password: string): { recoveryKey: string } {
  const passwordHash = hashPassword(password)
  const recoveryKey = generateRecoveryKey()
  const recoveryKeyHash = hashRecoveryKey(recoveryKey)

  const existing = queryOne('SELECT id FROM users WHERE school_id = ? ORDER BY id DESC LIMIT 1', [schoolId]) as { id: number } | undefined
  if (existing?.id) {
    queryRun(
      'UPDATE users SET password_hash = ?, recovery_key_hash = ? WHERE id = ?',
      [passwordHash, recoveryKeyHash, existing.id]
    )
  } else {
    queryRun(
      'INSERT INTO users (school_id, password_hash, recovery_key_hash) VALUES (?, ?, ?)',
      [schoolId, passwordHash, recoveryKeyHash]
    )
  }

  return { recoveryKey }
}

export function verifyLogin(password: string): boolean {
  const user = queryOne('SELECT password_hash FROM users ORDER BY id DESC LIMIT 1') as { password_hash: string } | undefined
  if (!user) return false
  return verifyPassword(password, user.password_hash)
}

export function resetPassword(recoveryKey: string, newPassword: string): boolean {
  const user = queryOne('SELECT recovery_key_hash FROM users ORDER BY id DESC LIMIT 1') as { recovery_key_hash: string } | undefined
  if (!user) return false
  if (!verifyRecoveryKey(recoveryKey, user.recovery_key_hash)) return false

  const newPasswordHash = hashPassword(newPassword)
  queryRun('UPDATE users SET password_hash = ?', [newPasswordHash])
  return true
}

export function changePassword(currentPassword: string, newPassword: string): boolean {
  if (!verifyLogin(currentPassword)) return false
  const newPasswordHash = hashPassword(newPassword)
  queryRun('UPDATE users SET password_hash = ?', [newPasswordHash])
  return true
}
