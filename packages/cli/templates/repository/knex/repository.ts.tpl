import type { Knex } from 'knex';
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
  tenantRow,
  type TenantRow,
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
    const row = await tableOf(this.database)
      .where({ id, ...this.ownTenant() })
      .first();
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

  private async insert(state: Versioned{{aggregate.pascal}}): Promise<number> {
    const row = { ...state, {{#if tenant.scoped}}...this.ownTenant(), {{/if}}...auditRow(stampCreation(this.scope, this.clock)) };

    const inserted = await insertIgnoringConflict(this.database.executor(), tableOf(this.database), {
      row,
      conflict: 'id',
    });

    return inserted ? 1 : 0;
  }

  private async update(state: Versioned{{aggregate.pascal}}, expected: number): Promise<number> {
    return tableOf(this.database)
      .where({ id: state.id, version: expected{{#if tenant.scoped}}, ...this.ownTenant(){{/if}} })
      .update({ ...state, ...auditRow(stampUpdate(this.scope, this.clock)) });
  }
{{#if tenant.scoped}}

  private ownTenant(): TenantRow {
    return tenantRow(tenantScopeOf(this.scope));
  }
{{/if}}
}

/** A function and not a method: a query builder is thenable, and a method that answers one is read as asynchronous by whatever wraps the adapter (tracing), which then answers a promise. */
function tableOf(database: KnexContext): Knex.QueryBuilder<{{aggregate.pascal}}Row, {{aggregate.pascal}}Row[]> {
  const table = database.executor()<{{aggregate.pascal}}Row, {{aggregate.pascal}}Row[]>('{{aggregate.table}}');

  return table.withSchema({{context.constant}}_SCHEMA);
}
