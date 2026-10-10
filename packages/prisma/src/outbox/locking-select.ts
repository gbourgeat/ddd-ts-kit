import type { PrismaSkipLockedClaim } from './prisma-outbox-claim.js';

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** The statement Prisma Client cannot express. Identifiers are checked: this is unsafe raw SQL. */
export function lockingSelect(claim: Pick<PrismaSkipLockedClaim<never>, 'dialect' | 'schema' | 'table'>): string {
  const names = [claim.schema, claim.table ?? 'outbox'].filter((name) => name !== undefined);

  for (const name of names) {
    if (!IDENTIFIER.test(name)) {
      throw new TypeError(`"${name}" is not a plain SQL identifier`);
    }
  }

  const postgres = claim.dialect === 'postgresql';
  const quote = (name: string): string => (postgres ? `"${name}"` : `\`${name}\``);
  const parameter = (position: number): string => (postgres ? `$${position}` : '?');

  return [
    `select ${quote('id')} from ${names.map(quote).join('.')}`,
    `where ${quote('status')} = ${parameter(1)} and ${quote('next_attempt_at')} <= ${parameter(2)}`,
    `order by ${quote('next_attempt_at')}, ${quote('sequence')} limit ${parameter(3)}`,
    'for update skip locked',
  ].join(' ');
}
