import { createHash, randomBytes } from 'node:crypto';
import { Adapter } from '@ddd-ts-kit/kernel/declarations';
import { InvitationTokens } from '{{alias.context}}/application/ports/invitation-tokens.port{{alias.ext}}';

/** 256 bits: a token is never guessed, and never stored. */
const TOKEN_BYTES = 32;

/** Tokens drawn from the random source of the platform, kept as their SHA-256 digest. */
@Adapter(InvitationTokens, { kind: 'external' })
export class CryptoInvitationTokens implements InvitationTokens {
  issue(): { token: string; digest: string } {
    const token = randomBytes(TOKEN_BYTES).toString('base64url');

    return { token, digest: this.digestOf(token) };
  }

  digestOf(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
