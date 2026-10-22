import { systemActor } from '../actor/system-actor';
import { NEVER_ISSUED } from './never-issued';
import type { Session } from './session';

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
