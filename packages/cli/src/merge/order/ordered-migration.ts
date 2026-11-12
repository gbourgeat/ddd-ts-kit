import type { Migration } from '../../check/migrations/migration-folder';

/** The ORM whose migrations are files or folders the tool orders itself. */
export type NamedOrm = 'knex' | 'prisma' | 'typeorm';

/** A migration with what its tool orders it by. */
export interface OrderedMigration extends Migration {
  /**
   * The name of the file without its extension (knex), the name of the folder (Prisma), or the
   * 13 digits that end the name of the class (TypeORM, which never reads the name of the file).
   */
  readonly key: string;
}
