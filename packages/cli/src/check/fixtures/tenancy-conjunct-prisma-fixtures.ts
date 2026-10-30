import type { Fixture } from './fixture';
import { conjunctCases } from './conjunct-cases';

const { refused, accepted } = conjunctCases('prisma');

const SPREAD = '...tenantWhere(this.scope)';
const OWN_SPREAD = '...ownTenantWhere(this.scope)';
const MODEL = 'this.database.client().invoice';

export const TENANCY_CONJUNCT_PRISMA_FIXTURES: readonly Fixture[] = [
  refused('under OR', `return ${MODEL}.findFirst({ where: { OR: [{ id, ${SPREAD} }, { note: id }] } });`),
  refused(
    'under OR on every branch',
    `return ${MODEL}.findMany({ where: { OR: [{ id, ${SPREAD} }, { note: id, ${SPREAD} }] } });`,
  ),
  refused('under NOT', `return ${MODEL}.findMany({ where: { NOT: { ${SPREAD} } } });`),
  refused(
    'under OR under AND',
    `return ${MODEL}.findMany({ where: { AND: [{ id }, { OR: [{ ${SPREAD} }, { note: id }] }] } });`,
  ),
  refused(
    'a local put under OR',
    `const mine = { ${SPREAD} };\n\n    return ${MODEL}.findMany({ where: { OR: [mine, { note: id }] } });`,
  ),
  refused(
    'a where in a local',
    `const where = { OR: [{ ${SPREAD} }, { note: id }] };\n\n    return ${MODEL}.findMany({ where });`,
  ),
  refused(
    'under OR on a write',
    `return ${MODEL}.updateMany({ where: { OR: [{ id, ${OWN_SPREAD} }, { note: id }] }, data });`,
  ),
  refused('under NOT on a delete', `return ${MODEL}.deleteMany({ where: { NOT: { ${OWN_SPREAD} } } });`),
  refused('on a relation only', `return ${MODEL}.findMany({ where: { customer: { ${SPREAD} } } });`),
  refused(
    'on one branch of a choice',
    `return ${MODEL}.findMany({ where: { ...(all ? {} : tenantWhere(this.scope)) } });`,
  ),
  refused(
    'in an include and not in the where',
    `return ${MODEL}.findMany({ where: { id }, include: { lines: { where: { ${SPREAD} } } } });`,
  ),
  accepted('beside an OR', `return ${MODEL}.findMany({ where: { ${SPREAD}, OR: [{ id }, { note: id }] } });`),
  accepted('after an OR', `return ${MODEL}.findMany({ where: { OR: [{ id }, { note: id }], ${SPREAD} } });`),
  accepted('beside a NOT', `return ${MODEL}.count({ where: { NOT: { id }, ${SPREAD} } });`),
  accepted(
    'in an AND beside an OR',
    `return ${MODEL}.findMany({ where: { AND: [{ ${SPREAD} }, { OR: [{ id }, { note: id }] }] } });`,
  ),
  accepted(
    'beside an OR on a write',
    `return ${MODEL}.updateMany({ where: { OR: [{ id }, { note: id }], ${OWN_SPREAD} }, data });`,
  ),
  accepted('as the where itself', `return ${MODEL}.findMany({ where: tenantWhere(this.scope), take: 20 });`),
  accepted(
    'a local beside an OR',
    `const mine = tenantWhere(this.scope);\n\n    return ${MODEL}.findMany({ where: { ...mine, OR: [{ id }, { note: id }] } });`,
  ),
  accepted(
    'a where in a typed local',
    `const where: Prisma.InvoiceWhereInput = { OR: [{ id }, { note: id }], ${SPREAD} };\n\n    return ${MODEL}.findMany({ where });`,
  ),
  accepted(
    'the arguments in a local',
    `const found = { where: { id, ${SPREAD} }, take: 1 };\n\n    return ${MODEL}.findMany(found);`,
  ),
  accepted(
    'a where that states its type',
    `return ${MODEL}.findMany({ where: { id, ${SPREAD} } satisfies Prisma.InvoiceWhereInput });`,
  ),
  accepted(
    'on both branches of a choice',
    `return ${MODEL}.findMany({ where: { ...(own ? ownTenantWhere(this.scope) : tenantWhere(this.scope)) } });`,
  ),
  accepted(
    'beside a where on a relation',
    `return ${MODEL}.findMany({ where: { id, ${SPREAD} }, include: { lines: { where: { OR: [{ a }, { b }] } } } });`,
  ),
  accepted(
    'in a groupBy',
    `return ${MODEL}.groupBy({ by: ['status'], where: { ${SPREAD}, OR: [{ a }, { b }] }, _sum: { due: true } });`,
  ),
];
