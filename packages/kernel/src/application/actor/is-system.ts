import type { Actor } from './actor';

export function isSystem(actor: Actor): boolean {
  return actor.type === 'system';
}
