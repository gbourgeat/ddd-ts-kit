/** The tools whose migrations know no trigger: each is written in the dialect of its migrations. */
export type GuardedOrm = 'drizzle' | 'prisma' | 'typeorm';

const BREAKPOINT = '\n--> statement-breakpoint\n';

/** The migration that creates the audit entries, the statements of the guard after what it does. */
export function guardedText(orm: GuardedOrm, migration: string, statements: readonly string[]): string {
  if (orm === 'drizzle') {
    return `${migration.trimEnd()}${BREAKPOINT}${statements.map((statement) => `${statement};`).join(BREAKPOINT)}\n`;
  }

  if (orm === 'prisma') {
    return `${migration.trimEnd()}\n\n-- The audit trail is append-only: @ddd-ts-kit/audit refuses to rewrite it.\n${statements.map((statement) => `${statement};`).join('\n\n')}\n`;
  }

  return inTheUpOfAClass(migration, statements);
}

/** A TypeORM migration: one `queryRunner.query` per statement, at the end of `up`. */
function inTheUpOfAClass(migration: string, statements: readonly string[]): string {
  const down = migration.indexOf('public async down(');
  const endOfUp = down === -1 ? -1 : migration.lastIndexOf('}', down);

  if (endOfUp === -1) {
    throw new Error('The migration holds no `up` and `down` methods to add the audit guard to.');
  }

  const line = migration.lastIndexOf('\n', endOfUp) + 1;
  const calls = statements.map((statement) => `        await queryRunner.query(\`${escaped(statement)}\`);\n`).join('');

  return `${migration.slice(0, line)}${calls}${migration.slice(line)}`;
}

function escaped(statement: string): string {
  return statement.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${');
}
