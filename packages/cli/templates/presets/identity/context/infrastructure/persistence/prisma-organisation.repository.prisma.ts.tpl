import { optimisticUpdate, rowsCreated } from '@ddd-ts-kit/prisma';
import { stampCreation, stampUpdate, type Clock, type ExecutionScope } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Repository } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
import type { Organisation } from '{{alias.context}}/domain/aggregates/organisation.aggregate{{alias.ext}}';
{{#if style.declared}}
import { OrganisationRepository } from '{{alias.context}}/domain/repositories/organisation.repository{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import type { OrganisationRepository } from '{{alias.context}}/domain/repositories/organisation.repository{{alias.ext}}';
{{/unless}}
import type { Database } from '{{alias.platform}}/database/database{{alias.ext}}';
import { OrganisationMapper, type OrganisationColumns } from '{{alias.context}}/infrastructure/persistence/organisation.mapper{{alias.ext}}';

type VersionedOrganisation = OrganisationColumns & { readonly version: number };

{{#if style.declared}}
@Repository(OrganisationRepository)
{{/if}}
export class PrismaOrganisationRepository implements OrganisationRepository {
  constructor(
    private readonly database: Database,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Organisation | undefined> {
    const row = await organisationsOf(this.database).findUnique({ where: { id } });

    return row === null ? undefined : OrganisationMapper.toDomain(row);
  }

  async save(saved: Organisation): Promise<void> {
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...OrganisationMapper.toRow(saved), version: next };

      return expected === 0 ? this.insert(state) : (await this.update(state, expected)).count;
    });
  }

  private async insert(state: VersionedOrganisation): Promise<number> {
    const row = { ...state, ...stampCreation(this.scope, this.clock) };
    const created = await organisationsOf(this.database).createMany({ data: [row], skipDuplicates: true });

    return rowsCreated(created, {
      id: state.id,
      holders: () => organisationsOf(this.database).count({ where: { id: state.id } }),
    });
  }

  private update(state: VersionedOrganisation, expected: number): Promise<{ count: number }> {
    return organisationsOf(this.database).updateMany({
      where: { id: state.id, version: expected },
      data: { ...state, ...stampUpdate(this.scope, this.clock) },
    });
  }
}

/** The organisations on the client of the unit of work, which every statement of this file goes through. */
function organisationsOf(database: Database): ReturnType<Database['client']>['{{context.camel}}Organisation'] {
  return database.client().{{context.camel}}Organisation;
}
