import type { KnexSchemaDifference } from './knex-schema-difference';

/** A migration of a Knex project: the SQL of the difference, held in the file so that it never changes with the application. */
export function knexMigrationText({ statements, unwritten }: KnexSchemaDifference): string {
  const body = [...unwritten.map(todoLine), ...statements.map(statementLine)].join('\n');

  return `// Written by \`npm run db:generate\`: what \`createTables\` builds and the migrations before this one do not.
export const up = async (knex) => {
${body}
};

export const down = () => {
  throw new Error('A migration is not reverted: write a new one.');
};
`;
}

function todoLine(line: string): string {
  return `  // TODO(domain): write this change by hand: ${line.replace(/\s+/g, ' ')}.`;
}

function statementLine(statement: string): string {
  return `  await knex.raw(\`${literal(statement)}\`);`;
}

/** The text of a template literal; `?` is what knex takes for a binding, unless escaped. */
function literal(statement: string): string {
  return statement.replace(/[\\`]|\$\{/g, '\\$&').replace(/\?/g, '\\\\?');
}
