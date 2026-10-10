import { systemActor } from '../actor/system-actor.js';
import { NEVER_ISSUED } from './never-issued.js';
import type { Session } from './session.js';

/** The session of the system acting on its own behalf: a scheduled job, a consumer. */
export function systemSession(name: string, issuedAt: Date = NEVER_ISSUED): Session {
  const actor = systemActor(name);

  return Object.freeze({
    id: actor.id,
    actor,
    issuedAt,
    authenticationMethod: 'service',
    extensions: Object.freeze({}),
  });
}
