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
  type TypeOrmContext,
  insertIgnoringConflict,
  optimisticUpdate,
  ownTenantWhere,
  tenantWhere,
} from '@ddd-ts-kit/typeorm';
{{/if}}
{{#unless tenant.scoped}}
import { type TypeOrmContext, insertIgnoringConflict, optimisticUpdate } from '@ddd-ts-kit/typeorm';
{{/unless}}
import type { {{aggregate.pascal}} } from '{{alias.context}}/domain/aggregates/{{aggregate.kebab}}.aggregate{{alias.ext}}';
{{#if style.declared}}
import { {{aggregate.pascal}}Repository } from '{{alias.context}}/domain/repositories/{{aggregate.kebab}}.repository{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import type { {{aggregate.pascal}}Repository } from '{{alias.context}}/domain/repositories/{{aggregate.kebab}}.repository{{alias.ext}}';
{{/unless}}
import { {{aggregate.tableCamel}} } from '{{alias.context}}/infrastructure/persistence/{{context.kebab}}.schema{{alias.ext}}';
import { {{aggregate.pascal}}Mapper } from '{{alias.context}}/infrastructure/persistence/{{aggregate.kebab}}.mapper{{alias.ext}}';
import type { {{aggregate.pascal}}Columns } from '{{alias.context}}/infrastructure/persistence/{{aggregate.kebab}}-row.schema{{alias.ext}}';

type Versioned{{aggregate.pascal}} = {{aggregate.pascal}}Columns & { version: number };

{{#if style.declared}}
@Repository({{aggregate.pascal}}Repository)
{{/if}}
export class TypeOrm{{aggregate.pascal}}Repository implements {{aggregate.pascal}}Repository {
  constructor(
    private readonly database: TypeOrmContext,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

{{#if tenant.scoped}}
  async findById(id: string): Promise<{{aggregate.pascal}} | undefined> {
    const row = await this.database.manager().findOneBy({{aggregate.tableCamel}}, { id, ...tenantWhere(this.scope) });

    return row === null ? undefined : {{aggregate.pascal}}Mapper.toDomain(row);
  }

  async save(saved: {{aggregate.pascal}}): Promise<void> {
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...{{aggregate.pascal}}Mapper.toRow(saved), version: next };

      return expected === 0 ? this.insert(state) : this.update(state, expected);
    });
  }

  /** The row is written in the tenant of the work: `tenantScopeOf` names it, `tenantWhere` finds it again. */
  private async insert(state: Versioned{{aggregate.pascal}}): Promise<number> {
    const row = { ...state, ...tenantScopeOf(this.scope), ...stampCreation(this.scope, this.clock) };

    return (await insertIgnoringConflict(this.database.manager(), {{aggregate.tableCamel}}, row)) ? 1 : 0;
  }

  private async update(state: Versioned{{aggregate.pascal}}, expected: number): Promise<number> {
    const guarded = { id: state.id, version: expected, ...ownTenantWhere(this.scope) };
    const row = { ...state, ...stampUpdate(this.scope, this.clock) };

    return (await this.database.manager().update({{aggregate.tableCamel}}, guarded, row)).affected ?? 0;
  }
}
{{/if}}
{{#unless tenant.scoped}}
  async findById(id: string): Promise<{{aggregate.pascal}} | undefined> {
    const row = await this.database.manager().findOneBy({{aggregate.tableCamel}}, { id });

    return row === null ? undefined : {{aggregate.pascal}}Mapper.toDomain(row);
  }

  async save(saved: {{aggregate.pascal}}): Promise<void> {
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...{{aggregate.pascal}}Mapper.toRow(saved), version: next };

      return expected === 0 ? this.insert(state) : this.update(state, expected);
    });
  }

  private async insert(state: Versioned{{aggregate.pascal}}): Promise<number> {
    const row = { ...state, ...stampCreation(this.scope, this.clock) };

    return (await insertIgnoringConflict(this.database.manager(), {{aggregate.tableCamel}}, row)) ? 1 : 0;
  }

  private async update(state: Versioned{{aggregate.pascal}}, expected: number): Promise<number> {
    const row = { ...state, ...stampUpdate(this.scope, this.clock) };
    const updated = await this.database.manager().update({{aggregate.tableCamel}}, { id: state.id, version: expected }, row);

    return updated.affected ?? 0;
  }
}
{{/unless}}
