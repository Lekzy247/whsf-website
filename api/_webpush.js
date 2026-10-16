// Minimal Web Push sender with Node's built-in crypto (no npm packages on this site).
// Payload encryption: RFC 8291 (aes128gcm content coding, RFC 8188). Sender identity: VAPID, RFC 8292 (ES256 JWT).
// Keys: VAPID_PUBLIC_KEY (uncompressed P-256 point, base64url) and VAPID_PRIVATE_KEY (the "d" value, base64url).

import { createCipheriv, createECDH, createHmac, createPrivateKey, randomBytes, sign } from 'node:crypto';

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const hmac = (key, data) => createHmac('sha256', key).update(data).digest();
// HKDF with a single block of output (all lengths used here are <= 32 bytes).
const hkdf = (salt, ikm, info, length) => hmac(hmac(salt, ikm), Buffer.concat([info, Buffer.from([1])])).subarray(0, length);

function vapidHeader(endpoint, publicKey, privateKey, subject) {
  const pub = Buffer.from(publicKey, 'base64url');
  const key = createPrivateKey({ key: { kty: 'EC', crv: 'P-256', d: privateKey, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) }, format: 'jwk' });
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = b64u(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }));
  const sig = sign('sha256', Buffer.from(`${head}.${claims}`), { key, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${head}.${claims}.${b64u(sig)}, k=${publicKey}`;
}

function encrypt(payload, p256dh, authSecret) {
  const uaPublic = Buffer.from(p256dh, 'base64url');
  const auth = Buffer.from(authSecret, 'base64url');
  const ecdh = createECDH('prime256v1');
  const asPublic = ecdh.generateKeys();
  const shared = ecdh.computeSecret(uaPublic);
  const ikm = hkdf(auth, shared, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]), 32);
  const salt = randomBytes(16);
  const cek = hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12);
  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, body]);
}

// Sends one push. Returns { ok, gone } - gone = the subscription no longer exists (404 / 410), delete it.
export async function sendPush(sub, data, { publicKey, privateKey, subject }) {
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: vapidHeader(sub.endpoint, publicKey, privateKey, subject),
      'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '86400', Urgency: 'normal'
    },
    body: encrypt(JSON.stringify(data), sub.p256dh, sub.auth)
  }).catch(() => null);
  if (!res) return { ok: false, gone: false };
  return { ok: res.status >= 200 && res.status < 300, gone: res.status === 404 || res.status === 410, status: res.status };
}
