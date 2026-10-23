import type { Actor } from './actor';

const ANONYMOUS: Actor = Object.freeze({
  id: 'anonymous',
  type: 'anonymous',
  roles: Object.freeze([]),
  attributes: Object.freeze({}),
});

/** The caller that presented no credential. */
export function anonymousActor(): Actor {
  return ANONYMOUS;
}
