import type { Permission } from './permission.js';

export function isPermission(value: unknown): value is Permission {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  if (!('id' in value) || !('context' in value) || !('name' in value) || !('description' in value)) {
    return false;
  }

  return typeof value.id === 'string' && value.id === `${String(value.context)}:${String(value.name)}`;
}
