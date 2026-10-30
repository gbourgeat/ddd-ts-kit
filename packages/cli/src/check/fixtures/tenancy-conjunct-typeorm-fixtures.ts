import type { Fixture } from './fixture';
import { conjunctCases } from './conjunct-cases';

const { refused, accepted } = conjunctCases('typeorm');

const SPREAD = '...tenantWhere(this.scope)';
const OWN_SPREAD = '...ownTenantWhere(this.scope)';
const MANAGER = 'this.database.manager()';
const BUILDER = `${MANAGER}.createQueryBuilder(invoices, 'invoice')`;

export const TENANCY_CONJUNCT_TYPEORM_FIXTURES: readonly Fixture[] = [
  refused(
    'a where array with an entry that does not spread it',
    `return ${MANAGER}.findOne(invoices, { where: [{ id, ${SPREAD} }, { note: id }] });`,
  ),
  refused('an array of criteria', `return ${MANAGER}.findBy(invoices, [{ id, ${SPREAD} }, { note: id }]);`),
  refused(
    'a count over such an array',
    `return ${MANAGER}.count(invoices, { where: [{ note: id }, { id, ${SPREAD} }] });`,
  ),
  refused(
    'such an array in a local',
    `const where = [{ id, ${SPREAD} }, { note: id }];\n\n    return ${MANAGER}.find(invoices, { where });`,
  ),
  refused(
    'an entry of the array that is a local',
    `const other = { note: id };\n\n    return ${MANAGER}.find(invoices, { where: [{ id, ${SPREAD} }, other] });`,
  ),
  refused('beside the where and not in it', `return ${MANAGER}.find(invoices, { ${SPREAD}, where: { id } });`),
  refused('on a relation only', `return ${MANAGER}.find(invoices, { where: { customer: { ${SPREAD} } } });`),
  refused(
    'orWhere after the where of a query builder',
    `return ${BUILDER}.where({ ${SPREAD} }).orWhere('invoice.note = :id', { id }).getMany();`,
  ),
  refused(
    'orWhere after a local on a delete',
    `const mine = { id, ${OWN_SPREAD} };\n\n    return ${MANAGER}.createQueryBuilder().delete().from(invoices).where(mine).orWhere('note = :id', { id }).execute();`,
  ),
  refused(
    'in Brackets beside an orWhere',
    `return ${BUILDER}.where(new Brackets((either) => either.where({ ${SPREAD} }).orWhere('note = :id', { id }))).getMany();`,
  ),
  refused('a where array in a query builder', `return ${BUILDER}.where([{ id, ${SPREAD} }, { note: id }]).getMany();`),
  refused('a where after the where that carries it', `return ${BUILDER}.where({ ${SPREAD} }).where({ id }).getMany();`),
  refused(
    'a where after the andWhere that carries it',
    `return ${BUILDER}.andWhere({ ${SPREAD} }).where({ id }).getMany();`,
  ),
  refused(
    'a where after a local on a delete',
    `const mine = { id, ${OWN_SPREAD} };\n\n    return ${MANAGER}.createQueryBuilder().delete().from(invoices).where(mine).where({ id }).execute();`,
  ),
  accepted('in the last where', `return ${BUILDER}.where({ id }).where({ ${SPREAD} }).getMany();`),
  accepted(
    'orHaving, which applies after the where',
    `return ${BUILDER}.where({ ${SPREAD} }).having('due > 1').orHaving('due < 0').getMany();`,
  ),
  accepted(
    'a where array whose entries all spread it',
    `return ${MANAGER}.find(invoices, { where: [{ id, ${SPREAD} }, { note: id, ${SPREAD} }] });`,
  ),
  accepted(
    'an array of criteria whose entries all spread it',
    `return ${MANAGER}.findBy(invoices, [{ id, ${SPREAD} }, { note: id, ${SPREAD} }]);`,
  ),
  accepted(
    'entries that spread a local',
    `const mine = tenantWhere(this.scope);\n\n    return ${MANAGER}.findOne(invoices, { where: [{ id, ...mine }, { note: id, ...mine }] });`,
  ),
  accepted(
    'a where in a local',
    `const where = { id, ${SPREAD} };\n\n    return ${MANAGER}.find(invoices, { where, order: { id: 'asc' } });`,
  ),
  accepted(
    'beside a clause of its entry',
    `return ${MANAGER}.find(invoices, { where: { ${SPREAD}, status: In(states) }, take: 20 });`,
  ),
  accepted(
    'Brackets in an andWhere',
    `return ${BUILDER}.where({ ${SPREAD} }).andWhere(new Brackets((either) => either.where('a').orWhere('b'))).getMany();`,
  ),
  accepted(
    'an andWhere that carries it',
    `return ${BUILDER}.where('invoice.id = :id', { id }).andWhere({ ${SPREAD} }).getMany();`,
  ),
  accepted(
    'a where array in a query builder',
    `return ${BUILDER}.where([{ id, ${SPREAD} }, { note: id, ${SPREAD} }]).getMany();`,
  ),
  accepted('a sum over its criteria', `return ${MANAGER}.sum(invoices, 'due', { ${SPREAD}, status });`),
];
