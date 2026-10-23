import type { EntityOptions } from './entity-options';

export function entityName(base: string, options: EntityOptions): string {
  return options.name ?? (options.schema === undefined ? base : `${base}_${options.schema}`);
}
