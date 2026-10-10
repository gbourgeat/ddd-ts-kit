import type { Actor } from './actor.js';

const ACTOR_TYPES: readonly string[] = ['user', 'service', 'system', 'anonymous'];

export function isActor(value: unknown): value is Actor {
  return (
    hasActorKeys(value) &&
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    ACTOR_TYPES.includes(value.type) &&
    Array.isArray(value.roles) &&
    typeof value.attributes === 'object' &&
    value.attributes !== null
  );
}

type ActorKeys = Record<'id' | 'type' | 'roles' | 'attributes', unknown>;

function hasActorKeys(value: unknown): value is ActorKeys {
  if (typeof value !== 'object' || value === null) return false;

  return 'id' in value && 'type' in value && 'roles' in value && 'attributes' in value;
}
