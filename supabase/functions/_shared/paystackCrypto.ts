/** HMAC-SHA512 verification for Paystack webhooks (Deno / Web Crypto) */

function arrayBufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const hex: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    hex.push(bytes[i].toString(16).padStart(2, '0'));
  }
  return hex.join('');
}

export async function computeHmacSha512(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  return arrayBufferToHex(signature);
}

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Verify Paystack webhook signature using HMAC-SHA512.
 * Returns true only when signature matches HMAC-SHA512(payload, secret).
 */
export async function verifyPaystackSignature(
  payload: string,
  signature: string,
  secretKey: string,
): Promise<boolean> {
  if (!secretKey || !signature || !payload) {
    return false;
  }

  const computedHash = await computeHmacSha512(payload, secretKey);
  return constantTimeCompare(computedHash, signature);
}
