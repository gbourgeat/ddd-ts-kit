import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Clock } from '../../application/ports/clock';
import type { FileGrant } from './file-grant';
import { isFileGrant } from './is-file-grant';

/**
 * The tokens of the links a `ServedFileStorage` signs: the grant in base64url, a dot, and its
 * HMAC-SHA256 under the secret. Whoever holds the token holds the grant until it expires; whoever
 * changes a byte of it holds nothing.
 */
export class SignedFileTokens {
  constructor(
    private readonly secret: string,
    private readonly clock: Clock,
  ) {}

  sign(grant: Omit<FileGrant, 'expiresAt'>, expiresInSeconds: number): { token: string; expiresAt: Date } {
    const expiresAt = Math.floor(this.clock.now().getTime() / 1_000) + expiresInSeconds;
    const payload = Buffer.from(JSON.stringify({ ...grant, expiresAt })).toString('base64url');

    return { token: `${payload}.${this.signatureOf(payload)}`, expiresAt: new Date(expiresAt * 1_000) };
  }

  /** The grant of a genuine, unexpired token for this action, or `undefined`. */
  verify(token: string, action: FileGrant['action']): FileGrant | undefined {
    const [payload = '', signature = ''] = token.split('.');
    const expected = Buffer.from(this.signatureOf(payload));
    const given = Buffer.from(signature);

    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      return undefined;
    }

    const grant = parsed(payload);
    const now = this.clock.now().getTime() / 1_000;

    return grant?.action === action && grant.expiresAt > now ? grant : undefined;
  }

  private signatureOf(payload: string): string {
    return createHmac('sha256', this.secret).update(payload).digest('base64url');
  }
}

function parsed(payload: string): FileGrant | undefined {
  try {
    const value: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));

    return isFileGrant(value) ? value : undefined;
  } catch {
    return undefined;
  }
}
