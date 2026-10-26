/**
 * A migration TypeORM wrote, its import of `MigrationInterface` and `QueryRunner` made type-only,
 * as `verbatimModuleSyntax` asks of an import that names types alone.
 */
export function typeOnlyImports(migration: string): string {
  return migration.replace(/^import \{([^}]*)\} from ["']typeorm["'];?$/m, "import type {$1} from 'typeorm';");
}
