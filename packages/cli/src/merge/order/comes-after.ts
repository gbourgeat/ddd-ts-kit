import type { NamedOrm } from './ordered-migration';

/**
 * Whether the tool runs a migration after another, by their keys: the order of the strings for
 * knex and Prisma, which sort names, the number for TypeORM, which sorts the stamps of the
 * classes. `verify-merge` and the landing both ask it here, so that they never disagree.
 */
export function comesAfter(orm: NamedOrm, key: string, previous: string): boolean {
  return orm === 'typeorm' ? Number(key) > Number(previous) : key > previous;
}
