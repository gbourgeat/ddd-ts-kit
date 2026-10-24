import { accessorUses, type AccessorUse } from './accessor-uses';

/** Every use of the executor of a Knex or Drizzle context, with what surrounds it in its statement. */
export function executorUses(code: string): readonly AccessorUse[] {
  return accessorUses(code, 'executor');
}
