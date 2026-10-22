import type { Session } from './session';

export function isImpersonated(session: Session): boolean {
  return session.impersonatedBy !== undefined;
}
