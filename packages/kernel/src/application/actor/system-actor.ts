import type { Actor } from './actor';

/** The system acting on its own behalf: a scheduled job, a consumer, a migration. */
export function systemActor(name: string): Actor {
  return Object.freeze({
    id: `system:${name}`,
    type: 'system',
    roles: Object.freeze([]),
    attributes: Object.freeze({}),
  });
}
