// supabase/functions/_shared/appleJws.ts (Tali HQ, 22 Nov 2026)
//
// Verifies data signed by the App Store (StoreKit 2 transactions, renewal
// info, and App Store Server Notifications V2). Copied from Totality Nutrition (17 Oct 2026) for Apple
// In-App Purchase (App Review Guideline 3.1.1).
//
// Apple signs these as compact JWS (ES256) with the signing certificate
// chain in the header's x5c: [leaf, intermediate, root]. We trust a payload
// only when ALL of these hold:
//   1. the root cert is Apple Root CA - G3 (SHA-256 fingerprint pinned below,
//      from Apple's published root list),
//   2. leaf is signed by the intermediate and the intermediate by the root,
//   3. every cert in the chain is inside its validity window,
//   4. the leaf and intermediate carry Apple's marker extensions,
//   5. the JWS signature verifies against the leaf's public key.

import { compactVerify, decodeProtectedHeader, importX509 } from 'npm:jose@5.9.6'
import * as x509 from 'npm:@peculiar/x509@1.12.3'

x509.cryptoProvider.set(crypto)

// Apple Root CA - G3, SHA-256 fingerprint (support.apple.com/121728)
const APPLE_ROOT_CA_G3_SHA256 =
  '63343ABFB89A6A03EBB57E9B3F5FA7BE7C4F5C756F3017B3A8C488C3653E9179'

// Apple marker extensions
const OID_LEAF = '1.2.840.113635.100.6.11.1'          // App Store receipt signing
const OID_INTERMEDIATE = '1.2.840.113635.100.6.2.1'   // Apple WWDR intermediate

export class AppleJwsError extends Error {}

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64)
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
}

function hasExtension(cert: x509.X509Certificate, oid: string): boolean {
  return cert.extensions.some(e => e.type === oid)
}

function toPem(b64Der: string): string {
  const lines = b64Der.match(/.{1,64}/g)?.join('\n') ?? b64Der
  return `-----BEGIN CERTIFICATE-----\n${lines}\n-----END CERTIFICATE-----`
}

export async function verifyAppleJws<T = Record<string, unknown>>(
  jws: string,
  opts: { rootFingerprintOverride?: string } = {},
): Promise<T> {
  if (typeof jws !== 'string' || jws.split('.').length !== 3) {
    throw new AppleJwsError('Not a compact JWS')
  }

  const header = decodeProtectedHeader(jws)
  if (header.alg !== 'ES256') throw new AppleJwsError(`Unexpected alg ${header.alg}`)
  const x5c = header.x5c
  if (!Array.isArray(x5c) || x5c.length !== 3) throw new AppleJwsError('Missing certificate chain')

  const [leaf, intermediate, root] = x5c.map(c => new x509.X509Certificate(b64ToBytes(c)))

  // 1. Pinned Apple root
  const rootFp = toHex(await crypto.subtle.digest('SHA-256', b64ToBytes(x5c[2])))
  const expectedRoot = opts.rootFingerprintOverride ?? APPLE_ROOT_CA_G3_SHA256
  if (rootFp !== expectedRoot) throw new AppleJwsError('Root certificate is not Apple Root CA - G3')

  // 2. Chain signatures
  const leafOk = await leaf.verify({ publicKey: await intermediate.publicKey.export(), signatureOnly: true })
  const interOk = await intermediate.verify({ publicKey: await root.publicKey.export(), signatureOnly: true })
  if (!leafOk || !interOk) throw new AppleJwsError('Certificate chain signature check failed')

  // 3. Validity windows
  const now = Date.now()
  for (const c of [leaf, intermediate, root]) {
    if (now < c.notBefore.getTime() || now > c.notAfter.getTime()) {
      throw new AppleJwsError('Certificate outside its validity period')
    }
  }

  // 4. Apple marker extensions (skipped only in tests with a fake root)
  if (!opts.rootFingerprintOverride) {
    if (!hasExtension(leaf, OID_LEAF)) throw new AppleJwsError('Leaf certificate is not an App Store signing cert')
    if (!hasExtension(intermediate, OID_INTERMEDIATE)) throw new AppleJwsError('Intermediate is not Apple WWDR')
  }

  // 5. JWS signature with the leaf key
  const key = await importX509(toPem(x5c[0]), 'ES256')
  const { payload } = await compactVerify(jws, key)
  return JSON.parse(new TextDecoder().decode(payload)) as T
}

// ── Shared business rules ───────────────────────────────────────────────

export const TALI_BUNDLE_ID = 'au.com.totality360.talihq'
export { TALI_PRODUCT_IDS, planForAppleProduct } from './appleProducts.ts'

// StoreKit 2 JWSTransactionDecodedPayload (fields we use)
export type AppleTransaction = {
  transactionId: string
  originalTransactionId: string
  bundleId: string
  productId: string
  expiresDate?: number
  revocationDate?: number
  appAccountToken?: string
  environment?: string
  type?: string
}

export function isTransactionActive(tx: AppleTransaction, graceUntilMs?: number): boolean {
  if (tx.revocationDate) return false
  const until = Math.max(tx.expiresDate ?? 0, graceUntilMs ?? 0)
  return until > Date.now()
}
