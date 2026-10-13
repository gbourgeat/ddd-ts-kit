/** A statement of the schema: it changes tables, never reads or writes their rows. */
const SCHEMA_STATEMENT = /^\s*(?:create|alter|drop|comment)\b/i;

/** The words of SQL that read or write rows, whatever the statement they are in. */
const ROW_WORDS =
  /\b(?:select|insert|update|delete|from|join|into|truncate|merge|copy|values|call|execute|returning)\b/i;

/** Further words that start a statement or name a table in an expression: `table invoices`, `with ...`, `do ...`, `lock ...`. */
const STATEMENT_WORDS = /\b(?:table|with|do|lock|using|exists)\b/i;

/** What may be called in an expression over the rows a confined statement reads: aggregates, casts, arithmetic, text. */
const EXPRESSION_FUNCTIONS = new Set([
  'count',
  'sum',
  'avg',
  'min',
  'max',
  'coalesce',
  'nullif',
  'greatest',
  'least',
  'round',
  'floor',
  'ceil',
  'abs',
  'date_part',
  'date_trunc',
  'extract',
  'lower',
  'upper',
  'length',
  'concat',
  'to_char',
  'cast',
  'string_agg',
  'array_agg',
  'bool_and',
  'bool_or',
  'json_agg',
  'jsonb_agg',
  'json_build_object',
  'jsonb_build_object',
  'numeric',
  'decimal',
  'varchar',
  'char',
  'timestamp',
  'interval',
]);

/** Words of SQL followed by a parenthesis that call nothing. */
const SYNTAX_BEFORE_PARENTHESIS = new Set([
  'in',
  'filter',
  'over',
  'any',
  'all',
  'and',
  'or',
  'not',
  'as',
  'by',
  'when',
  'then',
  'else',
  'where',
  'is',
]);

const CALL = /([A-Za-z_][\w$]*)\s*\(/g;

/**
 * Whether the literal SQL of a raw call can reach rows by itself. A statement of the schema that
 * holds no word of rows cannot; an expression can only if it holds a word that reads or writes
 * rows, starts a statement, or calls a function outside the expressions known to work on the
 * rows already confined (a function call may run any statement).
 */
export function rawReachesRows(sql: string): boolean {
  const text = withoutQuotedText(sql);

  if (ROW_WORDS.test(text)) {
    return true;
  }

  if (SCHEMA_STATEMENT.test(text)) {
    return false;
  }

  return STATEMENT_WORDS.test(text) || callsAnUnknownFunction(text);
}

function callsAnUnknownFunction(text: string): boolean {
  return [...text.matchAll(CALL)].some(([, name = '']) => {
    const word = name.toLowerCase();

    return !EXPRESSION_FUNCTIONS.has(word) && !SYNTAX_BEFORE_PARENTHESIS.has(word);
  });
}

/** Text in quotes says nothing of what the SQL does: `'.'`, `'epoch'`, a quoted identifier. */
function withoutQuotedText(sql: string): string {
  return sql.replace(/'(?:[^']|'')*'/g, "''").replace(/"(?:[^"]|"")*"/g, '""');
}
