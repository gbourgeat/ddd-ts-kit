import type { Session } from './session.js';

export function isImpersonated(session: Session): boolean {
  return session.impersonatedBy !== undefined;
}
