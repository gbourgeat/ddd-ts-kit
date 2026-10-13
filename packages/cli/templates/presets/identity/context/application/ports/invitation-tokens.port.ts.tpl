/** The tokens of the invitations: unguessable, sent to the person, never stored but as a digest. */
export abstract class InvitationTokens {
  /** A new token, and the digest the invitation keeps of it. */
  abstract issue(): { readonly token: string; readonly digest: string };

  abstract digestOf(token: string): string;
}
