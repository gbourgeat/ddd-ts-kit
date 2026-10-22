import type { ResourceRef } from '../authorization/resource-ref';

export function objectOf(resource: ResourceRef): string {
  return `${resource.type}:${resource.id}`;
}
