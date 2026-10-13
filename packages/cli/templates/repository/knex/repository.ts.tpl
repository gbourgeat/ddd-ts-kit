{{#unless tenant.scoped}}
import type { Knex } from 'knex';
{{/unless}}
{{#if tenant.scoped}}
import { stampCreation, stampUpdate, tenantScopeOf, type Clock, type ExecutionScope } from '@ddd-ts-kit/kernel';
{{/if}}
{{#unless tenant.scoped}}
import { stampCreation, stampUpdate, type Clock, type ExecutionScope } from '@ddd-ts-kit/kernel';
{{/unless}}
{{#if style.declared}}
import { Repository } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
{{#if tenant.scoped}}
import {
  type KnexContext,
  auditRow,
  insertIgnoringConflict,
  optimisticUpdate,
  ownTenantTable,
  tenantRow,
  tenantTable,
} from '@ddd-ts-kit/knex';
{{/if}}
{{#unless tenant.scoped}}
import { type KnexContext, auditRow, insertIgnoringConflict, optimisticUpdate } from '@ddd-ts-kit/knex';
{{/unless}}
import type { {{aggregate.pascal}} } from '{{alias.context}}/domain/aggregates/{{aggregate.kebab}}.aggregate{{alias.ext}}';
{{#if style.declared}}
import { {{aggregate.pascal}}Repository } from '{{alias.context}}/domain/repositories/{{aggregate.kebab}}.repository{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import type { {{aggregate.pascal}}Repository } from '{{alias.context}}/domain/repositories/{{aggregate.kebab}}.repository{{alias.ext}}';
{{/unless}}
import { {{context.constant}}_SCHEMA } from '{{alias.context}}/infrastructure/persistence/{{context.kebab}}.schema{{alias.ext}}';
import { {{aggregate.pascal}}Mapper } from '{{alias.context}}/infrastructure/persistence/{{aggregate.kebab}}.mapper{{alias.ext}}';
import type { {{aggregate.pascal}}Columns, {{aggregate.pascal}}Row } from '{{alias.context}}/infrastructure/persistence/{{aggregate.kebab}}-row.schema{{alias.ext}}';

type Versioned{{aggregate.pascal}} = {{aggregate.pascal}}Columns & { readonly version: number };
{{#if tenant.scoped}}

/** Tenant data: every statement reaches it through `tenantTable` or `ownTenantTable`, confined to the tenant of the work. */
const TABLE = { schema: {{context.constant}}_SCHEMA, table: '{{aggregate.table}}' };
{{/if}}

{{#if style.declared}}
@Repository({{aggregate.pascal}}Repository)
{{/if}}
export class Knex{{aggregate.pascal}}Repository implements {{aggregate.pascal}}Repository {
  constructor(
    private readonly database: KnexContext,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<{{aggregate.pascal}} | undefined> {
{{#if tenant.scoped}}
    const row = await tenantTable<{{aggregate.pascal}}Row>(this.database, this.scope, TABLE).where({ id }).first();
{{/if}}
{{#unless tenant.scoped}}
    const row = await tableOf(this.database).where({ id }).first();
{{/unless}}

    return row === undefined ? undefined : {{aggregate.pascal}}Mapper.toDomain(row);
  }

  async save(saved: {{aggregate.pascal}}): Promise<void> {
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...{{aggregate.pascal}}Mapper.toRow(saved), version: next };

      return expected === 0 ? this.insert(state) : this.update(state, expected);
    });
  }

{{#if tenant.scoped}}
  private async insert(state: Versioned{{aggregate.pascal}}): Promise<number> {
    const tenant = tenantRow(tenantScopeOf(this.scope));
    const row = { ...state, ...tenant, ...auditRow(stampCreation(this.scope, this.clock)) };
    const table = ownTenantTable<{{aggregate.pascal}}Row>(this.database, this.scope, TABLE);

    const inserted = await insertIgnoringConflict(this.database.executor(), table, { row, conflict: 'id' });

    return inserted ? 1 : 0;
  }

  private async update(state: Versioned{{aggregate.pascal}}, expected: number): Promise<number> {
    return ownTenantTable<{{aggregate.pascal}}Row>(this.database, this.scope, TABLE)
      .where({ id: state.id, version: expected })
      .update({ ...state, ...auditRow(stampUpdate(this.scope, this.clock)) });
  }
}
{{/if}}
{{#unless tenant.scoped}}
  private async insert(state: Versioned{{aggregate.pascal}}): Promise<number> {
    const row = { ...state, ...auditRow(stampCreation(this.scope, this.clock)) };

    const inserted = await insertIgnoringConflict(this.database.executor(), tableOf(this.database), {
      row,
      conflict: 'id',
    });

    return inserted ? 1 : 0;
  }

  private async update(state: Versioned{{aggregate.pascal}}, expected: number): Promise<number> {
    return tableOf(this.database)
      .where({ id: state.id, version: expected })
      .update({ ...state, ...auditRow(stampUpdate(this.scope, this.clock)) });
  }
}

/** A function and not a method: a query builder is thenable, and a method that answers one is read as asynchronous by whatever wraps the adapter (tracing), which then answers a promise. */
function tableOf(database: KnexContext): Knex.QueryBuilder<{{aggregate.pascal}}Row, {{aggregate.pascal}}Row[]> {
  const table = database.executor()<{{aggregate.pascal}}Row, {{aggregate.pascal}}Row[]>('{{aggregate.table}}');

  return table.withSchema({{context.constant}}_SCHEMA);
}
{{/unless}}
