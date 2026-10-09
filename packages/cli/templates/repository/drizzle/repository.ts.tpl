import { and, eq } from 'drizzle-orm';
import { optimisticUpdate } from '@ddd-ts-kit/drizzle/postgres';
{{#if tenant.scoped}}
import type { ActorContext } from '@ddd-ts-kit/kernel';
{{/if}}
import type { {{aggregate.pascal}} } from '../../domain/aggregates/{{aggregate.kebab}}.aggregate.js';
import type { {{aggregate.pascal}}Repository } from '../../domain/repositories/{{aggregate.kebab}}.repository.js';
import type { DatabaseContext } from '{{paths.persistenceToPlatform}}/database/database.js';
import { {{aggregate.tableCamel}} } from './{{context.kebab}}.schema.js';
import { {{aggregate.pascal}}Mapper } from './{{aggregate.kebab}}.mapper.js';

export class Drizzle{{aggregate.pascal}}Repository implements {{aggregate.pascal}}Repository {
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
{{#if tenant.scoped}}
    const mine = and(eq({{aggregate.tableCamel}}.id, id), eq({{aggregate.tableCamel}}.tenantId, this.#tenantId()));
    const [row] = await this.database.executor().select().from({{aggregate.tableCamel}}).where(mine);
{{/if}}
{{#unless tenant.scoped}}
    const [row] = await this.database.executor().select().from({{aggregate.tableCamel}}).where(eq({{aggregate.tableCamel}}.id, id));
{{/unless}}
    return row === undefined ? undefined : {{aggregate.pascal}}Mapper.toDomain(row);
  }

  async save(saved: {{aggregate.pascal}}): Promise<void> {
    const executor = this.database.executor();
{{#if tenant.scoped}}
    const tenantId = this.#tenantId();
{{/if}}
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const row = { ...{{aggregate.pascal}}Mapper.toRow(saved), {{#if tenant.scoped}}tenantId, {{/if}}version: next };
      const written =
        expected === 0
          ? await executor.insert({{aggregate.tableCamel}}).values(row).onConflictDoNothing().returning({ id: {{aggregate.tableCamel}}.id })
          : await executor
              .update({{aggregate.tableCamel}})
              .set(row)
              .where(and(eq({{aggregate.tableCamel}}.id, saved.id), {{#if tenant.scoped}}eq({{aggregate.tableCamel}}.tenantId, tenantId), {{/if}}eq({{aggregate.tableCamel}}.version, expected)))
              .returning({ id: {{aggregate.tableCamel}}.id });
      return written.length;
    });
  }
{{#if tenant.scoped}}

  #tenantId(): string {
    const { tenantId } = this.actors.require();
    if (tenantId === undefined) throw new Error('Tenant-scoped storage was reached by an actor without a tenant');
    return tenantId;
  }
{{/if}}
}
