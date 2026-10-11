{{#if style.declared}}
import { Clock, ExecutionScope, stampCreation, stampUpdate } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
{{#unless style.declared}}
import { stampCreation, stampUpdate, type Clock, type ExecutionScope } from '@ddd-ts-kit/kernel';
{{/unless}}
import { optimisticUpdate } from '@ddd-ts-kit/prisma';
import type { {{aggregate.pascal}} } from '{{alias.context}}/domain/aggregates/{{aggregate.kebab}}.aggregate{{alias.ext}}';
{{#if style.declared}}
import { {{aggregate.pascal}}Repository } from '{{alias.context}}/domain/repositories/{{aggregate.kebab}}.repository{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import type { {{aggregate.pascal}}Repository } from '{{alias.context}}/domain/repositories/{{aggregate.kebab}}.repository{{alias.ext}}';
{{/unless}}
{{storage.adapterImport}}
import { {{aggregate.pascal}}Mapper } from '{{alias.context}}/infrastructure/persistence/{{aggregate.kebab}}.mapper{{alias.ext}}';

{{#if style.declared}}
@Repository({{aggregate.pascal}}Repository, [Database, ExecutionScope, Clock])
{{/if}}
export class Prisma{{aggregate.pascal}}Repository implements {{aggregate.pascal}}Repository {
  constructor(
    private readonly database: Database,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

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
