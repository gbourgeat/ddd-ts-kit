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
import { optimisticUpdate, ownTenantWhere, tenantWhere } from '@ddd-ts-kit/prisma';
{{/if}}
{{#unless tenant.scoped}}
import { optimisticUpdate } from '@ddd-ts-kit/prisma';
{{/unless}}
import type { {{aggregate.pascal}} } from '{{alias.context}}/domain/aggregates/{{aggregate.kebab}}.aggregate{{alias.ext}}';
{{#if style.declared}}
import { {{aggregate.pascal}}Repository } from '{{alias.context}}/domain/repositories/{{aggregate.kebab}}.repository{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import type { {{aggregate.pascal}}Repository } from '{{alias.context}}/domain/repositories/{{aggregate.kebab}}.repository{{alias.ext}}';
{{/unless}}
{{storage.adapterImport}}
{{#if tenant.scoped}}
import { {{aggregate.pascal}}Mapper, type {{aggregate.pascal}}Columns } from '{{alias.context}}/infrastructure/persistence/{{aggregate.kebab}}.mapper{{alias.ext}}';
{{/if}}
{{#unless tenant.scoped}}
import { {{aggregate.pascal}}Mapper } from '{{alias.context}}/infrastructure/persistence/{{aggregate.kebab}}.mapper{{alias.ext}}';
{{/unless}}
{{#if tenant.scoped}}

type Versioned{{aggregate.pascal}} = {{aggregate.pascal}}Columns & { readonly version: number };
{{/if}}

{{#if style.declared}}
@Repository({{aggregate.pascal}}Repository)
{{/if}}
export class Prisma{{aggregate.pascal}}Repository implements {{aggregate.pascal}}Repository {
  constructor(
    private readonly database: Database,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

{{#if tenant.scoped}}
  async findById(id: string): Promise<{{aggregate.pascal}} | undefined> {
    // findFirst, not findUnique: the tenant is part of every condition, and it is not part of the key.
    const row = await this.database.client().{{context.camel}}{{aggregate.pascal}}.findFirst({
      where: { id, ...tenantWhere(this.scope) },
    });

    return row === null ? undefined : {{aggregate.pascal}}Mapper.toDomain(row);
  }

  async save(saved: {{aggregate.pascal}}): Promise<void> {
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...{{aggregate.pascal}}Mapper.toRow(saved), version: next };
      const written = expected === 0 ? await this.insert(state) : await this.update(state, expected);

      return written.count;
    });
  }

  /** The row is written in the tenant of the work: `tenantScopeOf` names it, `tenantWhere` finds it again. */
  private insert(state: Versioned{{aggregate.pascal}}): Promise<{ count: number }> {
    const row = { ...state, ...tenantScopeOf(this.scope), ...stampCreation(this.scope, this.clock) };

    return this.database.client().{{context.camel}}{{aggregate.pascal}}.createMany({ data: [row], skipDuplicates: true });
  }

  private update(state: Versioned{{aggregate.pascal}}, expected: number): Promise<{ count: number }> {
    return this.database.client().{{context.camel}}{{aggregate.pascal}}.updateMany({
      where: { id: state.id, version: expected, ...ownTenantWhere(this.scope) },
      data: { ...state, ...stampUpdate(this.scope, this.clock) },
    });
  }
}
{{/if}}
{{#unless tenant.scoped}}
  async findById(id: string): Promise<{{aggregate.pascal}} | undefined> {
    const row = await this.database.client().{{context.camel}}{{aggregate.pascal}}.findUnique({ where: { id } });

    return row === null ? undefined : {{aggregate.pascal}}Mapper.toDomain(row);
  }

  async save(saved: {{aggregate.pascal}}): Promise<void> {
    const table = this.database.client().{{context.camel}}{{aggregate.pascal}};

    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...{{aggregate.pascal}}Mapper.toRow(saved), version: next };

      const written =
        expected === 0
          ? await table.createMany({
              data: [{ ...state, ...stampCreation(this.scope, this.clock) }],
              skipDuplicates: true,
            })
          : await table.updateMany({
              where: { id: saved.id, version: expected },
              data: { ...state, ...stampUpdate(this.scope, this.clock) },
            });

      return written.count;
    });
  }
}
{{/unless}}
