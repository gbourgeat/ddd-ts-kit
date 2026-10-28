import { type EntityManager } from 'typeorm';
import { stampCreation, stampUpdate, type Clock, type ExecutionScope } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Repository } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
import { type TypeOrmContext, insertIgnoringConflict, optimisticUpdate } from '@ddd-ts-kit/typeorm';
import type { Organisation } from '{{alias.context}}/domain/aggregates/organisation.aggregate{{alias.ext}}';
{{#if style.declared}}
import { OrganisationRepository } from '{{alias.context}}/domain/repositories/organisation.repository{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import type { OrganisationRepository } from '{{alias.context}}/domain/repositories/organisation.repository{{alias.ext}}';
{{/unless}}
import { organisations } from '{{alias.context}}/infrastructure/persistence/{{context.kebab}}.schema{{alias.ext}}';
import { OrganisationMapper } from '{{alias.context}}/infrastructure/persistence/organisation.mapper{{alias.ext}}';
import type { OrganisationColumns } from '{{alias.context}}/infrastructure/persistence/organisation-row.schema{{alias.ext}}';

type VersionedOrganisation = OrganisationColumns & { version: number };

{{#if style.declared}}
@Repository(OrganisationRepository)
{{/if}}
export class TypeOrmOrganisationRepository implements OrganisationRepository {
  constructor(
    private readonly database: TypeOrmContext,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Organisation | undefined> {
    const row = await managerOf(this.database).findOneBy(organisations, { id });

    return row === null ? undefined : OrganisationMapper.toDomain(row);
  }

  async save(saved: Organisation): Promise<void> {
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...OrganisationMapper.toRow(saved), version: next };

      return expected === 0 ? this.insert(state) : this.update(state, expected);
    });
  }

  private async insert(state: VersionedOrganisation): Promise<number> {
    const row = { ...state, ...stampCreation(this.scope, this.clock) };

    return (await insertIgnoringConflict(managerOf(this.database), organisations, row)) ? 1 : 0;
  }

  private async update(state: VersionedOrganisation, expected: number): Promise<number> {
    const row = { ...state, ...stampUpdate(this.scope, this.clock) };

    const updated = await managerOf(this.database).update(organisations, { id: state.id, version: expected }, row);

    return updated.affected ?? 0;
  }
}

/** The manager of the unit of work, which every statement of this file goes through. */
function managerOf(database: TypeOrmContext): EntityManager {
{{#if tenancy.any}}
  // ddd-ts-kit-disable-next-line tenancy/scoped-statement -- {{preset.adr}}: the {{context.kebab}} context is the control plane of the tenants, and its rows belong to none of them.
{{/if}}
  return database.manager();
}
