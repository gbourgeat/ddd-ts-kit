import { and, eq } from 'drizzle-orm';
import { optimisticUpdate } from '@ddd-ts-kit/drizzle/postgres';
{{#if style.declared}}
{{#if tenant.scoped}}
import { Clock, ExecutionScope, stampCreation, stampUpdate, tenantScopeOf } from '@ddd-ts-kit/kernel';
{{/if}}
{{#unless tenant.scoped}}
import { Clock, ExecutionScope, stampCreation, stampUpdate } from '@ddd-ts-kit/kernel';
{{/unless}}
import { Repository } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
{{#unless style.declared}}
{{#if tenant.scoped}}
import { stampCreation, stampUpdate, tenantScopeOf, type Clock, type ExecutionScope } from '@ddd-ts-kit/kernel';
{{/if}}
{{#unless tenant.scoped}}
import { stampCreation, stampUpdate, type Clock, type ExecutionScope } from '@ddd-ts-kit/kernel';
{{/unless}}
{{/unless}}
import type { {{aggregate.pascal}} } from '{{alias.context}}/domain/aggregates/{{aggregate.kebab}}.aggregate.js';
{{#if style.declared}}
import { {{aggregate.pascal}}Repository } from '{{alias.context}}/domain/repositories/{{aggregate.kebab}}.repository.js';
{{/if}}
{{#unless style.declared}}
import type { {{aggregate.pascal}}Repository } from '{{alias.context}}/domain/repositories/{{aggregate.kebab}}.repository.js';
{{/unless}}
{{storage.adapterImport}}
import { {{aggregate.tableCamel}} } from '{{alias.context}}/infrastructure/persistence/{{context.kebab}}.schema.js';
import { {{aggregate.pascal}}Mapper, type {{aggregate.pascal}}Columns } from '{{alias.context}}/infrastructure/persistence/{{aggregate.kebab}}.mapper.js';

type Versioned{{aggregate.pascal}} = {{aggregate.pascal}}Columns & { readonly version: number };

{{#if style.declared}}
@Repository({{aggregate.pascal}}Repository, [Database, ExecutionScope, Clock])
{{/if}}
export class Drizzle{{aggregate.pascal}}Repository implements {{aggregate.pascal}}Repository {
  constructor(
    private readonly database: Database,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<{{aggregate.pascal}} | undefined> {
{{#if tenant.scoped}}
    const mine = and(eq({{aggregate.tableCamel}}.id, id), this.ownTenant());
    const [row] = await this.database.executor().select().from({{aggregate.tableCamel}}).where(mine);
{{/if}}
{{#unless tenant.scoped}}
    const byId = eq({{aggregate.tableCamel}}.id, id);
    const [row] = await this.database.executor().select().from({{aggregate.tableCamel}}).where(byId);
{{/unless}}

    return row === undefined ? undefined : {{aggregate.pascal}}Mapper.toDomain(row);
  }

  async save(saved: {{aggregate.pascal}}): Promise<void> {
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...{{aggregate.pascal}}Mapper.toRow(saved), version: next };
      const written = expected === 0 ? await this.insert(state) : await this.update(state, expected);

      return written.length;
    });
  }

  private insert(state: Versioned{{aggregate.pascal}}) {
    const row = { ...state, {{#if tenant.scoped}}...tenantScopeOf(this.scope), {{/if}}...stampCreation(this.scope, this.clock) };

    const insertion = this.database.executor().insert({{aggregate.tableCamel}}).values(row);

    return insertion.onConflictDoNothing().returning({ id: {{aggregate.tableCamel}}.id });
  }

  private update(state: Versioned{{aggregate.pascal}}, expected: number) {
    const sameId = eq({{aggregate.tableCamel}}.id, state.id);
    const sameVersion = eq({{aggregate.tableCamel}}.version, expected);

    return this.database
      .executor()
      .update({{aggregate.tableCamel}})
      .set({ ...state, ...stampUpdate(this.scope, this.clock) })
      .where(and(sameId, sameVersion{{#if tenant.scoped}}, this.ownTenant(){{/if}}))
      .returning({ id: {{aggregate.tableCamel}}.id });
  }
{{#if tenant.scoped}}

  private ownTenant() {
    return eq({{aggregate.tableCamel}}.tenantId, tenantScopeOf(this.scope).tenantId);
  }
{{/if}}
}
