import type { Actor } from './actor';

export function isAuthenticated(actor: Actor): boolean {
  return actor.type !== 'anonymous';
}
