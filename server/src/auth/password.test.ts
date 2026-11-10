import assert from 'node:assert/strict'
import test from 'node:test'
import { hashPassword, verifyPassword } from './password.js'

test('password hashes verify without storing the original password', () => {
  const password = 'correct-horse-battery-staple'
  const hash = hashPassword(password)

  assert.notEqual(hash, password)
  assert.equal(verifyPassword(password, hash), true)
  assert.equal(verifyPassword('wrong-password', hash), false)
  assert.equal(verifyPassword(password, 'plaintext-password'), false)
})
