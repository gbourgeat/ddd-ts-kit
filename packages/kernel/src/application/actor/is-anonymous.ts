import type { Actor } from './actor.js';

export function isAnonymous(actor: Actor): boolean {
  return actor.type === 'anonymous';
}
