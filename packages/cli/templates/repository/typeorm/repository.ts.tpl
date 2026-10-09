import { insertIgnoringConflict, optimisticUpdate } from '@ddd-ts-kit/typeorm';
import type { {{aggregate.pascal}} } from '../../domain/aggregates/{{aggregate.kebab}}.aggregate.js';
import type { {{aggregate.pascal}}Repository } from '../../domain/repositories/{{aggregate.kebab}}.repository.js';
import type { DatabaseContext } from '{{paths.persistenceToPlatform}}/database/database.js';
import { {{aggregate.tableCamel}} } from './{{context.kebab}}.schema.js';
import { {{aggregate.pascal}}Mapper } from './{{aggregate.kebab}}.mapper.js';

export class TypeOrm{{aggregate.pascal}}Repository implements {{aggregate.pascal}}Repository {
  constructor(private readonly database: DatabaseContext) {}

  async findById(id: string): Promise<{{aggregate.pascal}} | undefined> {
    const row = await this.database.manager().findOneBy({{aggregate.tableCamel}}, { id });
    return row === null ? undefined : {{aggregate.pascal}}Mapper.toDomain(row);
  }

  async save(saved: {{aggregate.pascal}}): Promise<void> {
    const manager = this.database.manager();
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const row = { ...{{aggregate.pascal}}Mapper.toRow(saved), version: next };
      if (expected === 0) {
        return (await insertIgnoringConflict(manager, {{aggregate.tableCamel}}, row)) ? 1 : 0;
      }
      const updated = await manager.update({{aggregate.tableCamel}}, { id: saved.id, version: expected }, row);
      return updated.affected ?? 0;
    });
  }
}
