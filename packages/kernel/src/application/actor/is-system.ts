import type { Actor } from './actor.js';

export function isSystem(actor: Actor): boolean {
  return actor.type === 'system';
}
