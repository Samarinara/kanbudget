export async function deriveKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  )
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 100_000,
      hash: "SHA-256",
    },
    key,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  )
}

export async function encrypt(
  data: unknown,
  key: CryptoKey
): Promise<ArrayBuffer> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(JSON.stringify(data))
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  )

  const result = new Uint8Array(iv.length + ciphertext.byteLength)
  result.set(iv)
  result.set(new Uint8Array(ciphertext), iv.length)
  return result.buffer
}

export async function decrypt<T>(
  data: ArrayBuffer,
  key: CryptoKey
): Promise<T> {
  const arr = new Uint8Array(data)
  const iv = arr.slice(0, 12)
  const ciphertext = arr.slice(12)

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  )

  const decoded = new TextDecoder().decode(decrypted)
  return JSON.parse(decoded) as T
}

export function generateSalt(): Uint8Array {
  return new Uint8Array(crypto.getRandomValues(new Uint16Array(8)))
}

export function saltToBase64(salt: Uint8Array): string {
  return btoa(String.fromCharCode(...salt))
}

export function base64ToSalt(base64: string): Uint8Array {
  const str = atob(base64)
  return new Uint8Array(str.charCodeAt(0))
}
