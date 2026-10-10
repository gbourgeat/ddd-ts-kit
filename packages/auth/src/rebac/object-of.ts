import type { ResourceRef } from '../authorization/resource-ref.js';

export function objectOf(resource: ResourceRef): string {
  return `${resource.type}:${resource.id}`;
}
