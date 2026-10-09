import type { Knex } from 'knex';
import { insertIgnoringConflict, optimisticUpdate } from '@ddd-ts-kit/knex';
{{#if tenant.scoped}}
import type { ActorContext } from '@ddd-ts-kit/kernel';
{{/if}}
import type { {{aggregate.pascal}} } from '../../domain/aggregates/{{aggregate.kebab}}.aggregate.js';
import type { {{aggregate.pascal}}Repository } from '../../domain/repositories/{{aggregate.kebab}}.repository.js';
import type { DatabaseContext } from '{{paths.persistenceToPlatform}}/database/database.js';
import { {{context.constant}}_SCHEMA, type {{aggregate.pascal}}Row } from './{{context.kebab}}.schema.js';
import { {{aggregate.pascal}}Mapper } from './{{aggregate.kebab}}.mapper.js';

export class Knex{{aggregate.pascal}}Repository implements {{aggregate.pascal}}Repository {
{{#if tenant.scoped}}
  constructor(
    private readonly database: DatabaseContext,
    private readonly actors: ActorContext,
  ) {}
{{/if}}
{{#unless tenant.scoped}}
  constructor(private readonly database: DatabaseContext) {}
{{/unless}}

  async findById(id: string): Promise<{{aggregate.pascal}} | undefined> {
    const row = await this.#table().where({ id{{#if tenant.scoped}}, tenant_id: this.#tenantId(){{/if}} }).first();
    return row === undefined ? undefined : {{aggregate.pascal}}Mapper.toDomain(row);
  }

  async save(saved: {{aggregate.pascal}}): Promise<void> {
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const row = { ...{{aggregate.pascal}}Mapper.toRow(saved), {{#if tenant.scoped}}tenant_id: this.#tenantId(), {{/if}}version: next };
      if (expected === 0) {
        return (await insertIgnoringConflict(this.database.executor(), this.#table(), { row, conflict: 'id' })) ? 1 : 0;
      }
      return this.#table().where({ id: saved.id, {{#if tenant.scoped}}tenant_id: this.#tenantId(), {{/if}}version: expected }).update(row);
    });
  }

  #table(): Knex.QueryBuilder<{{aggregate.pascal}}Row, {{aggregate.pascal}}Row[]> {
    return this.database.executor()<{{aggregate.pascal}}Row, {{aggregate.pascal}}Row[]>('{{aggregate.table}}').withSchema({{context.constant}}_SCHEMA);
  }
{{#if tenant.scoped}}

  #tenantId(): string {
    const { tenantId } = this.actors.require();
    if (tenantId === undefined) throw new Error('Tenant-scoped storage was reached by an actor without a tenant');
    return tenantId;
  }
{{/if}}
}
