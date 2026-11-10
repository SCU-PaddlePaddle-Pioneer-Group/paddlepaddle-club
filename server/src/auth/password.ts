import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const saltLength = 16
const keyLength = 64

export function hashPassword(password: string): string {
  const salt = randomBytes(saltLength)
  const hash = scryptSync(password, salt, keyLength)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [algorithm, saltHex, hashHex, extra] = storedHash.split('$')
  if (
    algorithm !== 'scrypt' ||
    !saltHex ||
    !hashHex ||
    extra !== undefined ||
    !/^[0-9a-f]+$/i.test(saltHex) ||
    !/^[0-9a-f]+$/i.test(hashHex)
  ) {
    return false
  }

  const salt = Buffer.from(saltHex, 'hex')
  const expectedHash = Buffer.from(hashHex, 'hex')
  if (salt.length !== saltLength || expectedHash.length !== keyLength) {
    return false
  }

  const actualHash = scryptSync(password, salt, keyLength)
  return timingSafeEqual(actualHash, expectedHash)
}
