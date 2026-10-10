import type { FieldValue, Predicate, PredicateTest } from '@ddd-ts-kit/kernel';
import type { PrismaWhere } from './prisma-criteria.js';

type Fields = Readonly<Record<string, string>>;

const COMPARISONS = { eq: 'equals', gt: 'gt', gte: 'gte', lt: 'lt', lte: 'lte', isNull: 'equals' } as const;

/**
 * A predicate of a criteria plan as a Prisma `where`. It is data, never text: Prisma binds
 * every value, and the keys are the model fields the adapter mapped. `fields` renames a field
 * of the read model whose model field differs.
 */
export function predicateToPrisma(predicate: Predicate | undefined, fields: Fields = {}): PrismaWhere {
  if (predicate === undefined) return {};

  if (predicate.kind === 'test') return tested(predicate, Object.hasOwn(fields, predicate.field) ? (fields[predicate.field] ?? predicate.field) : predicate.field);

  const parts = predicate.parts.map((part) => predicateToPrisma(part, fields));

  return predicate.kind === 'and' ? { AND: parts } : { OR: parts };
}

function tested(test: PredicateTest, field: string): PrismaWhere {
  if (test.operator === 'isNull') return { [field]: test.value === true ? null : { not: null } };

  return test.negated ? { NOT: { [field]: compared(test) } } : { [field]: compared(test) };
}

function compared({ operator, value }: PredicateTest): Readonly<Record<string, unknown>> {
  const values: FieldValue[] = typeof value === 'object' && !(value instanceof Date) ? [...value] : [value];
  const [first = null, second = null] = values;

  if (operator === 'in') return { in: values };

  if (operator === 'between') return { gte: first, lte: second };

  if (operator === 'contains' || operator === 'startsWith') return { [operator]: literal(String(first)) };

  return operator === 'ne' ? { not: { equals: first } } : { [COMPARISONS[operator]]: first };
}

/** Prisma hands the text of a search to `LIKE` as it is: `%`, `_` and `\` are escaped here. */
function literal(text: string): string {
  return text.replace(/[\\%_]/g, (special) => `\\${special}`);
}
