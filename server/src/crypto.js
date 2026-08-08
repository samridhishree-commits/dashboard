import crypto from 'node:crypto'

/**
 * Convin AES-256-GCM envelope:
 * { encrypted_data: base64(ciphertext||tag), iv: base64(12-byte nonce) }
 */
export function isEncryptionEnabled() {
  return Boolean(process.env.CONVIN_AES_KEY?.trim())
}

function getKey() {
  const raw = process.env.CONVIN_AES_KEY?.trim()
  if (!raw) throw new Error('CONVIN_AES_KEY is not set')
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error(`CONVIN_AES_KEY must decode to 32 bytes (got ${key.length})`)
  }
  return key
}

export function encryptPayload(payload) {
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const plain = Buffer.from(JSON.stringify(payload), 'utf8')
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    encrypted_data: Buffer.concat([encrypted, tag]).toString('base64'),
    iv: iv.toString('base64'),
  }
}

export function decryptPayload(envelope) {
  if (!envelope || typeof envelope !== 'object') {
    throw new Error('Invalid encrypted envelope')
  }
  const { encrypted_data, iv } = envelope
  if (!encrypted_data || !iv) throw new Error('Missing encrypted_data or iv')

  const key = getKey()
  const ivBuf = Buffer.from(iv, 'base64')
  const data = Buffer.from(encrypted_data, 'base64')
  if (data.length < 17) throw new Error('Ciphertext too short')

  const tag = data.subarray(data.length - 16)
  const ciphertext = data.subarray(0, data.length - 16)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, ivBuf)
  decipher.setAuthTag(tag)
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return JSON.parse(plain.toString('utf8'))
}

export function maybeEncryptBody(payload) {
  if (!isEncryptionEnabled()) return payload
  return encryptPayload(payload)
}

export function maybeDecryptBody(body) {
  if (!isEncryptionEnabled()) return body
  if (body && typeof body === 'object' && body.encrypted_data && body.iv) {
    return decryptPayload(body)
  }
  return body
}
