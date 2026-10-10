import type { Session } from './session.js';

/** A session without `expiresAt` never expires; one expires at the instant it names. */
export function isExpired(session: Session, now: Date): boolean {
  return session.expiresAt !== undefined && session.expiresAt.getTime() <= now.getTime();
}
