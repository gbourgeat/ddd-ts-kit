import { and, eq } from 'drizzle-orm';
import { optimisticUpdate } from '@ddd-ts-kit/drizzle/postgres';
import type { {{aggregate.pascal}} } from '../../domain/aggregates/{{aggregate.kebab}}.aggregate.js';
import type { {{aggregate.pascal}}Repository } from '../../domain/repositories/{{aggregate.kebab}}.repository.js';
import type { DatabaseContext } from '{{paths.persistenceToPlatform}}/database/database.js';
import { {{aggregate.tableCamel}} } from './{{context.kebab}}.schema.js';
import { {{aggregate.pascal}}Mapper } from './{{aggregate.kebab}}.mapper.js';

export class Drizzle{{aggregate.pascal}}Repository implements {{aggregate.pascal}}Repository {
  constructor(private readonly database: DatabaseContext) {}

  async findById(id: string): Promise<{{aggregate.pascal}} | undefined> {
    const [row] = await this.database.executor().select().from({{aggregate.tableCamel}}).where(eq({{aggregate.tableCamel}}.id, id));
    return row === undefined ? undefined : {{aggregate.pascal}}Mapper.toDomain(row);
  }

  async save(saved: {{aggregate.pascal}}): Promise<void> {
    const executor = this.database.executor();
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const row = { ...{{aggregate.pascal}}Mapper.toRow(saved), version: next };
      const written =
        expected === 0
          ? await executor.insert({{aggregate.tableCamel}}).values(row).onConflictDoNothing().returning({ id: {{aggregate.tableCamel}}.id })
          : await executor
              .update({{aggregate.tableCamel}})
              .set(row)
              .where(and(eq({{aggregate.tableCamel}}.id, saved.id), eq({{aggregate.tableCamel}}.version, expected)))
              .returning({ id: {{aggregate.tableCamel}}.id });
      return written.length;
    });
  }
}
