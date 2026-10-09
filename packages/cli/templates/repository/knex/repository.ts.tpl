import type { Knex } from 'knex';
{{#if tenant.scoped}}
import { stampCreation, stampUpdate, tenantScopeOf, type Clock, type ExecutionScope } from '@ddd-ts-kit/kernel';
import { auditRow, insertIgnoringConflict, optimisticUpdate, tenantRow, type TenantRow } from '@ddd-ts-kit/knex';
{{/if}}
{{#unless tenant.scoped}}
import { stampCreation, stampUpdate, type Clock, type ExecutionScope } from '@ddd-ts-kit/kernel';
import { auditRow, insertIgnoringConflict, optimisticUpdate } from '@ddd-ts-kit/knex';
{{/unless}}
import type { {{aggregate.pascal}} } from '../../domain/aggregates/{{aggregate.kebab}}.aggregate.js';
import type { {{aggregate.pascal}}Repository } from '../../domain/repositories/{{aggregate.kebab}}.repository.js';
import type { DatabaseContext } from '{{paths.persistenceToPlatform}}/database/database.js';
import { {{context.constant}}_SCHEMA, type {{aggregate.pascal}}Columns, type {{aggregate.pascal}}Row } from './{{context.kebab}}.schema.js';
import { {{aggregate.pascal}}Mapper } from './{{aggregate.kebab}}.mapper.js';

type Versioned{{aggregate.pascal}} = {{aggregate.pascal}}Columns & { readonly version: number };

export class Knex{{aggregate.pascal}}Repository implements {{aggregate.pascal}}Repository {
  constructor(
    private readonly database: DatabaseContext,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<{{aggregate.pascal}} | undefined> {
    const row = await this.#table().where({ id{{#if tenant.scoped}}, ...this.#ownTenant(){{/if}} }).first();
    return row === undefined ? undefined : {{aggregate.pascal}}Mapper.toDomain(row);
  }

  async save(saved: {{aggregate.pascal}}): Promise<void> {
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...{{aggregate.pascal}}Mapper.toRow(saved), version: next };
      return expected === 0 ? this.#insert(state) : this.#update(state, expected);
    });
  }

  async #insert(state: Versioned{{aggregate.pascal}}): Promise<number> {
    const row = { ...state, {{#if tenant.scoped}}...this.#ownTenant(), {{/if}}...auditRow(stampCreation(this.scope, this.clock)) };
    return (await insertIgnoringConflict(this.database.executor(), this.#table(), { row, conflict: 'id' })) ? 1 : 0;
  }

  async #update(state: Versioned{{aggregate.pascal}}, expected: number): Promise<number> {
    return this.#table()
      .where({ id: state.id, version: expected{{#if tenant.scoped}}, ...this.#ownTenant(){{/if}} })
      .update({ ...state, ...auditRow(stampUpdate(this.scope, this.clock)) });
  }

  #table(): Knex.QueryBuilder<{{aggregate.pascal}}Row, {{aggregate.pascal}}Row[]> {
    return this.database.executor()<{{aggregate.pascal}}Row, {{aggregate.pascal}}Row[]>('{{aggregate.table}}').withSchema({{context.constant}}_SCHEMA);
  }
{{#if tenant.scoped}}

  #ownTenant(): TenantRow {
    return tenantRow(tenantScopeOf(this.scope));
  }
{{/if}}
}
