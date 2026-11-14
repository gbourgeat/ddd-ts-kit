import type { Bound } from './bound-by';

/** One import as an index writes it: the entity it binds, the name here. */
export function bindingOf({ entity, local }: Pick<Bound, 'entity' | 'local'>): string {
  return `${entity}#${local}`;
}
