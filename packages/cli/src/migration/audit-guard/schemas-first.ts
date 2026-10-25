/**
 * A migration TypeORM wrote, which creates tables in schemas it never creates (TypeORM writes no
 * `CREATE SCHEMA`): each of them created first, if it does not exist, at the start of `up`.
 */
export function schemasFirst(migration: string): string {
  const schemas = [...new Set([...migration.matchAll(/CREATE TABLE "(\w+)"\."\w+"/g)].map((match) => match[1] ?? ''))];
  const up = /public async up\([^)]*\): Promise<void> \{\n/.exec(migration);

  if (schemas.length === 0 || up === null) {
    return migration;
  }

  const at = up.index + up[0].length;

  const created = schemas
    .map((schema) => `        await queryRunner.query(\`CREATE SCHEMA IF NOT EXISTS "${schema}"\`);\n`)
    .join('');

  return `${migration.slice(0, at)}${created}${migration.slice(at)}`;
}
