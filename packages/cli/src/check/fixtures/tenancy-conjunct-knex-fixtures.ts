import type { Fixture } from './fixture';
import { conjunctCases } from './conjunct-cases';

const { refused, accepted } = conjunctCases('knex');

const READ = 'tenantTable<InvoiceRow>(this.database, this.scope, INVOICES)';
const WRITE = 'ownTenantTable<InvoiceRow>(this.database, this.scope, INVOICES)';

export const TENANCY_CONJUNCT_KNEX_FIXTURES: readonly Fixture[] = [
  refused('orWhere chained on a read', `return ${READ}.where({ id }).orWhere({ note: id }).first();`),
  refused(
    'orWhere chained on a write',
    `return ${WRITE}.where({ status: 'sent' }).orWhere({ status: 'stale' }).update({ status: 'swept' });`,
  ),
  refused('orWhere on the next line', `return ${READ}\n      .where({ id })\n      .orWhere({ note: id });`),
  refused('orWhereIn', `return ${READ}.where({ id }).orWhereIn('note', notes);`),
  refused('orWhereNot', `return ${READ}.where({ id }).orWhereNot({ note: id });`),
  refused('orWhereNull', `return ${READ}.where({ id }).orWhereNull('note');`),
  refused('orWhereRaw', `return ${READ}.where({ id }).orWhereRaw('note = ?', [id]);`),
  refused('orWhereExists', `return ${READ}.where({ id }).orWhereExists(notes);`),
  refused('orWhere with a type argument', `return ${READ}.where({ id }).orWhere<InvoiceRow>({ note: id });`),
  refused('clearWhere', `return ${READ}.clearWhere().where({ id });`),
  refused('clearWhere on a local', `const table = ${WRITE};\n\n    return table.clearWhere().delete();`),
  refused(`clear of the conditions`, `return ${READ}.clear('where').where({ id });`),
  refused('the or modifier', `return ${READ}.where({ id }).or.where({ note: id });`),
  refused('orWhere on a local', `const table = ${READ}.where({ id });\n\n    return table.orWhere({ note: id });`),
  refused(
    'orWhere on a local of a write',
    `const table = ${WRITE};\n\n    return table.orWhere({ note: id }).delete();`,
  ),
  refused(
    'orWhere on a local reassigned',
    `let query = ${READ};\n\n    if (note) {\n      query = query.where({ id });\n      query = query.orWhere({ note });\n    }\n\n    return query;`,
  ),
  refused(
    'orWhere on a local built from a local',
    `const table = ${READ};\n    const mine = table.where({ id });\n\n    return mine.orWhere({ note: id });`,
  ),
  refused('orWhere on a clone', `const table = ${READ};\n\n    return table.clone().orWhere({ note: id });`),
  refused('orWhere on the builder of whereTenant', 'return whereTenant(rows, this.scope).orWhere({ note: id });'),
  refused(
    'orWhere in the builder given to whereTenant',
    'return whereTenant(rows.where({ id }).orWhere({ note: id }), this.scope);',
  ),
  refused(
    'orWhere on a local given to whereTenant',
    'const rows = invoices.where({ id }).orWhere({ note: id });\n\n    return whereTenant(rows, this.scope);',
  ),
  refused(
    'orWhere in a modify',
    `return ${READ}.modify((table) => {\n      void table.orWhere({ note: id });\n    });`,
  ),
  refused(
    'orWhere on what a method of the file answers',
    'return this.invoices().where({ id }).orWhere({ note: id });',
    `\n  private invoices(): Invoices {\n    return ${READ};\n  }\n`,
  ),
  refused(
    'orWhere in a subquery that is itself confined',
    `return ${READ}.whereIn('id', ${READ}.select('id').where({ id }).orWhere({ note: id }));`,
  ),
  accepted(
    'orWhere grouped in a where',
    `return ${READ}.where((either) => either.where({ id }).orWhere({ note: id })).first();`,
  ),
  accepted(
    'orWhere grouped in a block',
    `return ${WRITE}\n      .where((either) => {\n        void either.where({ status: 'sent' }).orWhere({ status: 'stale' });\n      })\n      .update({ status: 'swept' });`,
  ),
  accepted(
    'groups nested, in andWhere and whereNot',
    `return ${READ}\n      .andWhere((either) => either.where({ id }).orWhere((tied) => tied.where({ a }).orWhere({ b })))\n      .whereNot((either) => either.where({ c }).orWhere({ d }));`,
  ),
  accepted(
    'a group on a local',
    `const table = ${READ};\n\n    return table.where((either) => {\n      void either.where({ id }).orWhere({ note: id });\n    });`,
  ),
  accepted(
    'a subquery with its own alternatives',
    `return ${READ}.whereIn('customer_id', (customers) => customers.select('id').from('customers').where({ a }).orWhere({ b }));`,
  ),
  accepted(
    'orHaving grouped',
    `return ${READ}.groupBy('status').having((due) => due.having('due', '>', 1).orHaving('due', '<', 0));`,
  ),
  accepted('orOn in a join', `return ${READ}.join('lines', (on) => on.on('a', 'b').orOn('c', 'd'));`),
  accepted(
    'a select over a confined query',
    `const grouped = ${READ}.select('status').groupBy('status');\n\n    return derivedTable(this.database, grouped, 'dues').where({ a }).orWhere({ b });`,
  ),
  accepted('orderBy, which only starts alike', `return ${READ}.where({ id }).orderBy('id').orderByRaw('note');`),
  accepted(
    'orHaving at the top, which applies after the where',
    `return ${READ}.groupBy('status').having('due', '>', 1).orHaving('due', '<', 0).orHavingRaw('count(*) > 1');`,
  ),
  accepted(
    'a clear of what is no condition',
    `return ${READ}.clear('select').clearSelect().clearOrder().clearHaving().where({ id });`,
  ),
  accepted(
    'whereRaw and andWhereRaw, which stay one conjunct',
    `return ${READ}.whereRaw('id = ? or note = ?', [id, id]).andWhereRaw('a = 1 or b = 2');`,
  ),
  accepted('a modify given a function of its own', `return ${READ}.modify(withStatus, status);`),
  accepted(
    'the words in a text or a comment',
    `// never .orWhere() here\n    return ${READ}.where({ note: '.orWhere(' });`,
  ),
  accepted(
    'a parameter named as a local of another method',
    `const table = ${READ};\n\n    return table.first();`,
    '\n  private either(table: Group) {\n    return table.where({ a }).orWhere({ b });\n  }\n',
  ),
  accepted(
    'a parameter named as the local it groups',
    `const query = ${READ};\n\n    return query.where((query) => query.where({ a }).orWhere({ b }));`,
  ),
  accepted(
    'a block of its own that names the parameter as the local',
    `const query = ${READ};\n\n    return query.where((query) => {\n      void query.where({ a }).orWhere({ b });\n    }).first();`,
  ),
  accepted('rows already read', `const rows = await ${READ};\n\n    return rows.filter(isDue);`),
];
