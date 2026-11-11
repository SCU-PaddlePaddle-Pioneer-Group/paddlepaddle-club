import assert from 'node:assert/strict'
import test from 'node:test'
import { loadConfig } from './config.js'

test('trusted proxy addresses are opt-in and read from environment', () => {
  const original = process.env.TRUSTED_PROXY_ADDRESSES
  try {
    delete process.env.TRUSTED_PROXY_ADDRESSES
    assert.deepEqual(loadConfig().trustedProxyAddresses, [])

    process.env.TRUSTED_PROXY_ADDRESSES = '127.0.0.1, 10.0.0.0/8'
    assert.deepEqual(loadConfig().trustedProxyAddresses, [
      '127.0.0.1',
      '10.0.0.0/8',
    ])

    process.env.TRUSTED_PROXY_ADDRESSES = '*'
    assert.throws(
      () => loadConfig(),
      /TRUSTED_PROXY_ADDRESSES 不能使用通配符/,
    )
  } finally {
    if (original === undefined) {
      delete process.env.TRUSTED_PROXY_ADDRESSES
    } else {
      process.env.TRUSTED_PROXY_ADDRESSES = original
    }
  }
})
