const NAME = String.raw`(?:["\x60\[]?[\w$]+["\x60\]]?\s*\.\s*)?["\x60\[]?([A-Za-z_][\w$]*)`;

/** The statements of SQL and the calls of the knex schema builder that name the table they change. */
const TABLE_NAMES = [
  new RegExp(
    String.raw`\b(?:CREATE|ALTER|DROP|TRUNCATE)\s+TABLE\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?(?:ONLY\s+)?${NAME}`,
    'gi',
  ),
  new RegExp(
    String.raw`\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?\S*\s*ON\s+(?:ONLY\s+)?${NAME}`,
    'gi',
  ),
  new RegExp(String.raw`\bREFERENCES\s+${NAME}`, 'gi'),
  /\.(?:createTable|createTableIfNotExists|alterTable|table|dropTable|dropTableIfExists|renameTable)\(\s*['"`]([A-Za-z_][\w$]*)/g,
];

/** The tables a migration changes, by the identifiers its statements or schema calls name, in lower case. */
export function mentionedTables(text: string): Set<string> {
  return new Set(
    TABLE_NAMES.flatMap((pattern) => [...text.matchAll(pattern)].map((match) => (match[1] ?? '').toLowerCase())).filter(
      (name) => name !== '',
    ),
  );
}
