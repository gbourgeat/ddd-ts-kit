import type { InvitationTokens } from '{{alias.context}}/application/ports/invitation-tokens.port{{alias.ext}}';

/** Tokens a spec can predict: `token-1`, `token-2`..., each digest `digest-of-<token>`. */
export class FakeInvitationTokens implements InvitationTokens {
  private issued = 0;

  issue(): { token: string; digest: string } {
    this.issued += 1;

    const token = `token-${this.issued}`;

    return { token, digest: this.digestOf(token) };
  }

  digestOf(token: string): string {
    return `digest-of-${token}`;
  }
}
