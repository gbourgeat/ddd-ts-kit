import { and, eq } from 'drizzle-orm';
import { optimisticUpdate } from '@ddd-ts-kit/drizzle/postgres';
{{#if tenant.scoped}}
import { stampCreation, stampUpdate, tenantScopeOf, type Clock, type ExecutionScope } from '@ddd-ts-kit/kernel';
{{/if}}
{{#unless tenant.scoped}}
import { stampCreation, stampUpdate, type Clock, type ExecutionScope } from '@ddd-ts-kit/kernel';
{{/unless}}
import type { {{aggregate.pascal}} } from '../../domain/aggregates/{{aggregate.kebab}}.aggregate.js';
import type { {{aggregate.pascal}}Repository } from '../../domain/repositories/{{aggregate.kebab}}.repository.js';
import type { DatabaseContext } from '{{paths.persistenceToPlatform}}/database/database.js';
import { {{aggregate.tableCamel}} } from './{{context.kebab}}.schema.js';
import { {{aggregate.pascal}}Mapper, type {{aggregate.pascal}}Columns } from './{{aggregate.kebab}}.mapper.js';

type Versioned{{aggregate.pascal}} = {{aggregate.pascal}}Columns & { readonly version: number };

export class Drizzle{{aggregate.pascal}}Repository implements {{aggregate.pascal}}Repository {
  constructor(
    private readonly database: DatabaseContext,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<{{aggregate.pascal}} | undefined> {
{{#if tenant.scoped}}
    const mine = and(eq({{aggregate.tableCamel}}.id, id), this.#ownTenant());
    const [row] = await this.database.executor().select().from({{aggregate.tableCamel}}).where(mine);
{{/if}}
{{#unless tenant.scoped}}
    const [row] = await this.database.executor().select().from({{aggregate.tableCamel}}).where(eq({{aggregate.tableCamel}}.id, id));
{{/unless}}
    return row === undefined ? undefined : {{aggregate.pascal}}Mapper.toDomain(row);
  }

  async save(saved: {{aggregate.pascal}}): Promise<void> {
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...{{aggregate.pascal}}Mapper.toRow(saved), version: next };
      const written = expected === 0 ? await this.#insert(state) : await this.#update(state, expected);
      return written.length;
    });
  }

  #insert(state: Versioned{{aggregate.pascal}}) {
    const row = { ...state, {{#if tenant.scoped}}...tenantScopeOf(this.scope), {{/if}}...stampCreation(this.scope, this.clock) };
    return this.database.executor().insert({{aggregate.tableCamel}}).values(row).onConflictDoNothing().returning({ id: {{aggregate.tableCamel}}.id });
  }

  #update(state: Versioned{{aggregate.pascal}}, expected: number) {
    return this.database
      .executor()
      .update({{aggregate.tableCamel}})
      .set({ ...state, ...stampUpdate(this.scope, this.clock) })
      .where(and(eq({{aggregate.tableCamel}}.id, state.id), eq({{aggregate.tableCamel}}.version, expected){{#if tenant.scoped}}, this.#ownTenant(){{/if}}))
      .returning({ id: {{aggregate.tableCamel}}.id });
  }
{{#if tenant.scoped}}

  #ownTenant() {
    return eq({{aggregate.tableCamel}}.tenantId, tenantScopeOf(this.scope).tenantId);
  }
{{/if}}
}
