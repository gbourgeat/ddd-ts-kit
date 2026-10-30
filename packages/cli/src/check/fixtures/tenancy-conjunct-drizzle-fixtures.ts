import type { Fixture } from './fixture';
import { conjunctCases } from './conjunct-cases';

const { refused, accepted } = conjunctCases('drizzle');

const CONDITION = 'tenantCondition(invoices.tenantId, this.scope)';
const OWN_CONDITION = 'ownTenantCondition(invoices.tenantId, this.scope)';
const SELECT = 'this.database.executor().select().from(invoices)';

export const TENANCY_CONJUNCT_DRIZZLE_FIXTURES: readonly Fixture[] = [
  refused('under or', `return ${SELECT}.where(or(eq(invoices.id, id), ${CONDITION}));`),
  refused('under not', `return ${SELECT}.where(not(${CONDITION}));`),
  refused('in a sql template', `return ${SELECT}.where(sql\`\${${CONDITION}} or note = \${id}\`);`),
  refused(
    'under or under and',
    `return ${SELECT}.where(and(eq(invoices.id, id), or(${CONDITION}, isNull(invoices.note))));`,
  ),
  refused('under not under and', `return ${SELECT}.where(and(eq(invoices.id, id), not(and(${CONDITION}, eq(a, b)))));`),
  refused(
    'in a local under or',
    `const either = or(eq(invoices.id, id), ${CONDITION});\n\n    return ${SELECT}.where(either);`,
  ),
  refused(
    'a local of the condition put under or',
    `const mine = ${CONDITION};\n\n    return ${SELECT}.where(or(mine, eq(invoices.id, id)));`,
  ),
  refused(
    'a local under or given to and',
    `const either = or(eq(invoices.id, id), ${CONDITION});\n\n    return ${SELECT}.where(and(either, eq(a, b)));`,
  ),
  refused(
    'under or on an update',
    `return this.database.executor().update(invoices).set({ a }).where(or(eq(invoices.id, id), ${OWN_CONDITION}));`,
  ),
  refused(
    'under or on a delete',
    `return this.database.executor().delete(invoices).where(or(eq(invoices.id, id), ${OWN_CONDITION}));`,
  ),
  refused(
    'on one branch of a choice',
    `return ${SELECT}.where(id === undefined ? ${CONDITION} : eq(invoices.id, id));`,
  ),
  refused(
    'in a join and not in the where',
    `return ${SELECT}.innerJoin(lines, ${CONDITION}).where(eq(invoices.id, id));`,
  ),
  refused(
    'in a subquery and not in the statement',
    `return ${SELECT}.where(inArray(invoices.id, this.database.executor().select().from(lines).where(${CONDITION})));`,
  ),
  accepted(
    'beside an optional clause',
    `return ${SELECT}.where(and(${CONDITION}, filter?.id ? eq(invoices.id, filter.id) : undefined));`,
  ),
  accepted('alone in the where', `return ${SELECT}.where(${CONDITION});`),
  accepted(
    'beside an or',
    `return ${SELECT}.where(and(${CONDITION}, or(eq(invoices.id, id), eq(invoices.note, id))));`,
  ),
  accepted('after an or and a not', `return ${SELECT}.where(and(or(a, b), not(c), ${CONDITION}));`),
  accepted('in an and under an and', `return ${SELECT}.where(and(and(${CONDITION}, a), b));`),
  accepted('in parentheses', `return ${SELECT}.where((and(a, (${CONDITION}))));`),
  accepted(
    'locals given to and',
    `const mine = ${CONDITION};\n    const either = or(eq(invoices.id, id), eq(invoices.note, id));\n\n    return ${SELECT}.where(and(mine, either));`,
  ),
  accepted(
    'a local of a local',
    `const mine = ${CONDITION};\n    const found = and(mine, eq(invoices.id, id));\n\n    return ${SELECT}.where(found);`,
  ),
  accepted(
    'on both branches of a choice',
    `const mine = ${CONDITION};\n\n    return ${SELECT}.where(id === undefined ? mine : and(mine, eq(invoices.id, id)));`,
  ),
  accepted('beside a sql template', `return ${SELECT}.where(and(${CONDITION}, sql\`a = 1 or b = 2\`));`),
  accepted(
    'on an update, beside an or',
    `return this.database.executor().update(invoices).set({ a }).where(and(or(a, b), ${OWN_CONDITION}));`,
  ),
  accepted(
    'on a statement that goes on after its where',
    `return ${SELECT}.innerJoin(lines, or(a, b)).where(and(eq(invoices.id, id), ${CONDITION})).orderBy(desc(invoices.id)).limit(1);`,
  ),
];
