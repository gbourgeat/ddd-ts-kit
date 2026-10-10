import { isActor } from '../actor/is-actor.js';
import type { Session } from './session.js';

type SessionKeys = Record<'id' | 'actor' | 'issuedAt' | 'authenticationMethod' | 'extensions', unknown>;

/** Structural: what a boundary received as a principal is a session when it has its shape. */
export function isSession(value: unknown): value is Session {
  return (
    hasSessionKeys(value) &&
    typeof value.id === 'string' &&
    isActor(value.actor) &&
    value.issuedAt instanceof Date &&
    typeof value.authenticationMethod === 'string' &&
    typeof value.extensions === 'object' &&
    value.extensions !== null
  );
}

function hasSessionKeys(value: unknown): value is SessionKeys {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return ['id', 'actor', 'issuedAt', 'authenticationMethod', 'extensions'].every((key) => key in value);
}
