import type { ResourceRef } from '../authorization/resource-ref';
import type { ResourceAttributeValues } from './resource-attribute-values';

/** Where the attributes of an element come from: a projection, a cache, the owning context. */
export abstract class ResourceAttributes {
  static readonly tokenKey = 'auth.ResourceAttributes';

  abstract of(resource: ResourceRef): Promise<ResourceAttributeValues | undefined>;
}
