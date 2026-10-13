import type { SessionScope } from './session-scope.js';
import type { Session } from './session.js';

/** Whether the session was granted the scope; a request without a session was granted none. */
export function hasScope(session: Session | undefined, scope: SessionScope): boolean {
  return session?.scopes?.includes(scope) === true;
}
