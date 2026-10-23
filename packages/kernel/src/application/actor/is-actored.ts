import type { Actored } from './actored';
import { isActor } from './is-actor';

export function isActored(value: unknown): value is Actored {
  return typeof value === 'object' && value !== null && 'actor' in value && isActor(value.actor);
}
