import type { ResourceRef } from './resource-ref.js';

/** Strict on purpose: an aggregate that happens to have a `type` and an `id` is not a reference. */
export function isResourceRef(value: unknown): value is ResourceRef {
  if (typeof value !== 'object' || value === null || Object.keys(value).length !== 2) {
    return false;
  }

  if (!('type' in value) || !('id' in value)) {
    return false;
  }

  return typeof value.type === 'string' && typeof value.id === 'string';
}
