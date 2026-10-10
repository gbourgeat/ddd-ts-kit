import type { Actor } from './actor.js';

export function isAuthenticated(actor: Actor): boolean {
  return actor.type !== 'anonymous';
}
