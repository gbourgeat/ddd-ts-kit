import type { Actor } from './actor';

export function isAnonymous(actor: Actor): boolean {
  return actor.type === 'anonymous';
}
