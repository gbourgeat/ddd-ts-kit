const IDENTIFIER = '("([^"]|"")+"|[a-z_][a-z0-9_]*)';
const WHOLE = `[(]${IDENTIFIER} IS NOT NULL[)]`;

/**
 * The check constraint of the live rows as the kit writes it and as PostgreSQL prints it back
 * (`pg_get_constraintdef`), a regular expression both JavaScript and PostgreSQL read:
 * `CHECK ((deleted OR (title IS NOT NULL)))`, or `((a IS NOT NULL) AND (b IS NOT NULL))` after
 * the `OR` when it keeps several columns whole, `NOT VALID` at the end when it is not validated.
 * Nothing else is the kit's: a constraint of that name written otherwise is never read as holding
 * a column, and never dropped. It holds no backslash and no question mark, so a migration that
 * carries it in a string of JavaScript or in a statement with placeholders keeps it as it is.
 */
export const LIVE_ROWS_CONSTRAINT_FORM = `^CHECK [(][(]${IDENTIFIER} OR (${WHOLE}|[(]${WHOLE}( AND ${WHOLE})+[)])[)][)]( NOT VALID|)$`;
