import { REDACTED } from '@ddd-ts-kit/kernel';

/*
 * Each form in which a driver quotes a value of the statement it ran, as drizzle-orm 0.45, pg 8,
 * knex 3, TypeORM 1 and Prisma 7 write it on PostgreSQL. The statement stays, placeholders
 * included: it is what a failure is read for. Knex on PostgreSQL quotes `$1`, TypeORM the message
 * of the server: what they quote of a value is one of the forms of PostgreSQL.
 */
const QUOTED_VALUES: readonly (readonly [form: RegExp, redacted: string])[] = [
  // `DrizzleQueryError`: `Failed query: <statement>\nparams: <the parameters, joined by commas>`.
  [/^(Failed query: [\s\S]*?\nparams: )[\s\S]*$/, `$1${REDACTED}`],
  // The `detail` of a unique or a foreign key violation: `Key (email)=(ada@example.org) already exists.`
  [
    /(Key \([^)\n]*\)=\()[^\n]*?(\) (?:already exists|is not present in table|is still referenced from table))/g,
    `$1${REDACTED}$2`,
  ],
  // The `detail` of a not-null or a check violation: `Failing row contains (ada@example.org, null).`
  [/(Failing row contains \()[^\n]*(\)\.?)/g, `$1${REDACTED}$2`],
  // A value the server could not read: `invalid input syntax for type integer: "ada@example.org"`.
  [/((?:invalid input syntax for type|invalid input value for enum) [^:\n]+: ")[^\n]*(")/g, `$1${REDACTED}$2`],
  [/(date\/time field value out of range: ")[^\n]*(")/g, `$1${REDACTED}$2`],
  [/(value ")[^\n]*(" is out of range for type )/g, `$1${REDACTED}$2`],
];

/* The line of a message of Prisma that names the call it refused. */
const PRISMA_CALL = /^(?:Invalid|It occurred in the) `[^`]+` invocation(?: in|:)$/;
/* A colour of the terminal: the escape character, then `[<codes>m`. */
const COLOUR = new RegExp(`${String.fromCharCode(0x1b)}\\[[0-9;]*m`, 'g');
/* A field of the call Prisma renders when it refuses one: `    email: "ada@example.org",`. */
const PRISMA_ARGUMENT = /^(\s+[\w$]+: )(?![{[]\s*$)[^\n]*?(,?)$/;
const ARROW = '→';

/** The text with every value a failed statement quotes replaced by `[redacted]`. */
export function withoutQuotedValues(text: string): string {
  const redacted = QUOTED_VALUES.reduce((current, [form, replacement]) => current.replace(form, replacement), text);

  return withoutPrismaArguments(redacted);
}

/*
 * Prisma writes the call it refused, the code around it, then the arguments of the call with their
 * values after the line of the arrow (right after the call when it has no code to show), and the
 * reason, which is not indented.
 */
function withoutPrismaArguments(text: string): string {
  const lines = text.replace(COLOUR, '').split('\n');
  const invocation = lines.findIndex((line) => PRISMA_CALL.test(line));

  if (invocation === -1) {
    return text;
  }

  const arrow = lines.findIndex((line) => line.startsWith(ARROW));
  const from = arrow === -1 ? invocation : arrow;

  return lines
    .map((line, index) => (index > from ? line.replace(PRISMA_ARGUMENT, `$1${REDACTED}$2`) : line))
    .join('\n');
}
