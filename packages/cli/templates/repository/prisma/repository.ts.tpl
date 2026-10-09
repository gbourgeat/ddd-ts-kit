import { optimisticUpdate } from '@ddd-ts-kit/prisma';
import type { {{aggregate.pascal}} } from '../../domain/aggregates/{{aggregate.kebab}}.aggregate.js';
import type { {{aggregate.pascal}}Repository } from '../../domain/repositories/{{aggregate.kebab}}.repository.js';
import type { DatabaseContext } from '{{paths.persistenceToPlatform}}/database/database.js';
import { {{aggregate.pascal}}Mapper } from './{{aggregate.kebab}}.mapper.js';

export class Prisma{{aggregate.pascal}}Repository implements {{aggregate.pascal}}Repository {
  constructor(private readonly database: DatabaseContext) {}

  async findById(id: string): Promise<{{aggregate.pascal}} | undefined> {
    const row = await this.database.client().{{context.camel}}{{aggregate.pascal}}.findUnique({ where: { id } });
    return row === null ? undefined : {{aggregate.pascal}}Mapper.toDomain(row);
  }

  async save(saved: {{aggregate.pascal}}): Promise<void> {
    const table = this.database.client().{{context.camel}}{{aggregate.pascal}};
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const row = { ...{{aggregate.pascal}}Mapper.toRow(saved), version: next };
      const written =
        expected === 0
          ? await table.createMany({ data: [row], skipDuplicates: true })
          : await table.updateMany({ where: { id: saved.id, version: expected }, data: row });
      return written.count;
    });
  }
}
