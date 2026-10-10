import type { Actored } from './actored.js';
import { isActor } from './is-actor.js';

export function isActored(value: unknown): value is Actored {
  return typeof value === 'object' && value !== null && 'actor' in value && isActor(value.actor);
}
