import type { SqlStatement } from './sql-statement.js';

/**
 * A comment, a string, a quoted name, a dollar-quoted body (a `DO $$ .. $$` block keeps its own
 * semicolons), the semicolon that ends a statement, or anything else. An unterminated one runs to
 * the end of the file.
 */
const TOKENS =
  /--[^\n]*|\/\*[\s\S]*?(?:\*\/|$)|'(?:[^']|'')*'?|"(?:[^"]|"")*"?|\$(\w*)\$[\s\S]*?(?:\$\1\$|$)|;|[^-/'"$;]+|[\s\S]/g;

/** The statements of a SQL file in their order, as PostgreSQL runs them; `--> statement-breakpoint` of drizzle-kit is a comment. */
export function sqlStatements(sql: string): SqlStatement[] {
  const statements: SqlStatement[] = [];
  let text = '';
  let start = 1;
  let line = 1;

  for (const [token] of sql.matchAll(TOKENS)) {
    if (token === ';') {
      statements.push(...folded(text, start));
      text = '';
    } else if (token.startsWith('--') || token.startsWith('/*')) {
      text += ' ';
    } else {
      start = text.trim() === '' && token.trim() !== '' ? line + newlines(token.slice(0, token.search(/\S/))) : start;
      text += token;
    }

    line += newlines(token);
  }

  return [...statements, ...folded(text, start)];
}

function folded(text: string, line: number): SqlStatement[] {
  const statement = text.replace(/\s+/g, ' ').trim();

  return statement === '' ? [] : [{ text: statement, line }];
}

function newlines(text: string): number {
  return text.split('\n').length - 1;
}
