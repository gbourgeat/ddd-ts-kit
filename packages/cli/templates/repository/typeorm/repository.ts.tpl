import { stampCreation, stampUpdate, type Clock, type ExecutionScope } from '@ddd-ts-kit/kernel';
import { insertIgnoringConflict, optimisticUpdate } from '@ddd-ts-kit/typeorm';
{{#if style.declared}}
import { CLOCK, EXECUTION_SCOPE, Repository } from '@ddd-ts-kit/kernel/declarations';
import { {{aggregate.constant}}_REPOSITORY } from '../../application/ports/{{context.kebab}}.ports.js';
{{/if}}
import type { {{aggregate.pascal}} } from '../../domain/aggregates/{{aggregate.kebab}}.aggregate.js';
import type { {{aggregate.pascal}}Repository } from '../../domain/repositories/{{aggregate.kebab}}.repository.js';
import type { DatabaseContext } from '{{paths.persistenceToPlatform}}/database/database.js';
{{#if style.declared}}
import { DATABASE } from '{{paths.persistenceToPlatform}}/tokens.js';
{{/if}}
import { {{aggregate.tableCamel}} } from './{{context.kebab}}.schema.js';
import { {{aggregate.pascal}}Mapper } from './{{aggregate.kebab}}.mapper.js';

{{#if style.declared}}
@Repository({{aggregate.constant}}_REPOSITORY, [DATABASE, EXECUTION_SCOPE, CLOCK])
{{/if}}
export class TypeOrm{{aggregate.pascal}}Repository implements {{aggregate.pascal}}Repository {
  constructor(
    private readonly database: DatabaseContext,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<{{aggregate.pascal}} | undefined> {
    const row = await this.database.manager().findOneBy({{aggregate.tableCamel}}, { id });
    return row === null ? undefined : {{aggregate.pascal}}Mapper.toDomain(row);
  }

  async save(saved: {{aggregate.pascal}}): Promise<void> {
    const manager = this.database.manager();
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...{{aggregate.pascal}}Mapper.toRow(saved), version: next };
      if (expected === 0) {
        return (await insertIgnoringConflict(manager, {{aggregate.tableCamel}}, { ...state, ...stampCreation(this.scope, this.clock) })) ? 1 : 0;
      }
      const updated = await manager.update({{aggregate.tableCamel}}, { id: saved.id, version: expected }, { ...state, ...stampUpdate(this.scope, this.clock) });
      return updated.affected ?? 0;
    });
  }
}
