import { createHmac } from 'node:crypto';
import { canonicalize } from '../chain/canonicalize';
import type { AuditMasker } from './audit-masker';

export interface HmacMaskerOptions {
  /** Written before the hash (`<keyId>:<hex>`), so that a rotated key can be told apart. */
  readonly keyId?: string;
}

/**
 * HMAC-SHA-256 of the canonical form of the value, under one secret. Without the secret a
 * mask cannot be computed again, so a guess cannot be checked: destroying the secret makes
 * every mask it produced meaningless.
 */
export function hmacMasker(secret: string | Uint8Array, options: HmacMaskerOptions = {}): AuditMasker {
  const prefix = options.keyId === undefined ? '' : `${options.keyId}:`;

  return {
    mask: (value) => `${prefix}${createHmac('sha256', secret).update(canonicalize(value), 'utf8').digest('hex')}`,
  };
}
