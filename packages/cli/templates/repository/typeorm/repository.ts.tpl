{{#if style.declared}}
import { Clock, ExecutionScope, stampCreation, stampUpdate } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
{{#unless style.declared}}
import { stampCreation, stampUpdate, type Clock, type ExecutionScope } from '@ddd-ts-kit/kernel';
{{/unless}}
import { {{storage.typeormImport}}, insertIgnoringConflict, optimisticUpdate } from '@ddd-ts-kit/typeorm';
import type { {{aggregate.pascal}} } from '{{alias.context}}/domain/aggregates/{{aggregate.kebab}}.aggregate.js';
{{#if style.declared}}
import { {{aggregate.pascal}}Repository } from '{{alias.context}}/domain/repositories/{{aggregate.kebab}}.repository.js';
{{/if}}
{{#unless style.declared}}
import type { {{aggregate.pascal}}Repository } from '{{alias.context}}/domain/repositories/{{aggregate.kebab}}.repository.js';
{{/unless}}
import { {{aggregate.tableCamel}} } from '{{alias.context}}/infrastructure/persistence/{{context.kebab}}.schema.js';
import { {{aggregate.pascal}}Mapper } from '{{alias.context}}/infrastructure/persistence/{{aggregate.kebab}}.mapper.js';
import type { {{aggregate.pascal}}Columns } from '{{alias.context}}/infrastructure/persistence/{{aggregate.kebab}}-row.schema.js';

type Versioned{{aggregate.pascal}} = {{aggregate.pascal}}Columns & { version: number };

{{#if style.declared}}
@Repository({{aggregate.pascal}}Repository, [TypeOrmContext, ExecutionScope, Clock])
{{/if}}
export class TypeOrm{{aggregate.pascal}}Repository implements {{aggregate.pascal}}Repository {
  constructor(
    private readonly database: TypeOrmContext,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

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
