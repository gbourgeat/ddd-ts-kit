import { anonymousActor } from '../actor/anonymous-actor';
import { NEVER_ISSUED } from './never-issued';
import type { Session } from './session';

const ANONYMOUS_SESSION: Session = Object.freeze({
  id: 'anonymous',
  actor: anonymousActor(),
  issuedAt: NEVER_ISSUED,
  authenticationMethod: 'none',
  extensions: Object.freeze({}),
});

/** The session of a caller that presented no credential. It never expires. */
export function anonymousSession(): Session {
  return ANONYMOUS_SESSION;
}
