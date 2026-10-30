import { and, eq } from 'drizzle-orm';
{{#if tenant.scoped}}
import { optimisticUpdate, ownTenantCondition, primaryKeyOf, tenantCondition } from '@ddd-ts-kit/drizzle/postgres';
{{/if}}
{{#unless tenant.scoped}}
import { optimisticUpdate, primaryKeyOf } from '@ddd-ts-kit/drizzle/postgres';
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
import type { {{aggregate.pascal}} } from '{{alias.context}}/domain/aggregates/{{aggregate.kebab}}.aggregate{{alias.ext}}';
{{#if style.declared}}
import { {{aggregate.pascal}}Repository } from '{{alias.context}}/domain/repositories/{{aggregate.kebab}}.repository{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import type { {{aggregate.pascal}}Repository } from '{{alias.context}}/domain/repositories/{{aggregate.kebab}}.repository{{alias.ext}}';
{{/unless}}
{{storage.adapterImport}}
import { {{aggregate.tableCamel}} } from '{{alias.context}}/infrastructure/persistence/{{context.kebab}}.schema{{alias.ext}}';
import { {{aggregate.pascal}}Mapper, type {{aggregate.pascal}}Columns } from '{{alias.context}}/infrastructure/persistence/{{aggregate.kebab}}.mapper{{alias.ext}}';

type Versioned{{aggregate.pascal}} = {{aggregate.pascal}}Columns & { readonly version: number };

{{#if style.declared}}
@Repository({{aggregate.pascal}}Repository)
{{/if}}
export class Drizzle{{aggregate.pascal}}Repository implements {{aggregate.pascal}}Repository {
  constructor(
    private readonly database: Database,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<{{aggregate.pascal}} | undefined> {
{{#if tenant.scoped}}
    const mine = and(eq({{aggregate.tableCamel}}.id, id), tenantCondition({{aggregate.tableCamel}}.tenantId, this.scope));
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
    // The key alone: a row that takes a value another row holds under another unique constraint is refused.
    const ignoringTheKey = insertion.onConflictDoNothing({ target: primaryKeyOf({{aggregate.tableCamel}}) });

    return ignoringTheKey.returning({ id: {{aggregate.tableCamel}}.id });
  }

  private update(state: Versioned{{aggregate.pascal}}, expected: number) {
    const sameId = eq({{aggregate.tableCamel}}.id, state.id);
    const sameVersion = eq({{aggregate.tableCamel}}.version, expected);

    return this.database
      .executor()
      .update({{aggregate.tableCamel}})
      .set({ ...state, ...stampUpdate(this.scope, this.clock) })
      .where(and(sameId, sameVersion{{#if tenant.scoped}}, ownTenantCondition({{aggregate.tableCamel}}.tenantId, this.scope){{/if}}))
      .returning({ id: {{aggregate.tableCamel}}.id });
  }
}
