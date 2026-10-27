import type { Knex } from 'knex';
import { stampCreation, stampUpdate, type Clock, type ExecutionScope } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Repository } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
import { type KnexContext, auditRow, insertIgnoringConflict, optimisticUpdate } from '@ddd-ts-kit/knex';
import type { Organisation } from '{{alias.context}}/domain/aggregates/organisation.aggregate{{alias.ext}}';
{{#if style.declared}}
import { OrganisationRepository } from '{{alias.context}}/domain/repositories/organisation.repository{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import type { OrganisationRepository } from '{{alias.context}}/domain/repositories/organisation.repository{{alias.ext}}';
{{/unless}}
import { {{context.constant}}_SCHEMA } from '{{alias.context}}/infrastructure/persistence/{{context.kebab}}.schema{{alias.ext}}';
import { OrganisationMapper } from '{{alias.context}}/infrastructure/persistence/organisation.mapper{{alias.ext}}';
import type { OrganisationColumns, OrganisationRow } from '{{alias.context}}/infrastructure/persistence/organisation-row.schema{{alias.ext}}';

type VersionedOrganisation = OrganisationColumns & { readonly version: number };

{{#if style.declared}}
@Repository(OrganisationRepository)
{{/if}}
export class KnexOrganisationRepository implements OrganisationRepository {
  constructor(
    private readonly database: KnexContext,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Organisation | undefined> {
    const row = await tableOf(this.database).where({ id }).first();

    return row === undefined ? undefined : OrganisationMapper.toDomain(row);
  }

  async save(saved: Organisation): Promise<void> {
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...OrganisationMapper.toRow(saved), version: next };

      return expected === 0 ? this.insert(state) : this.update(state, expected);
    });
  }

  private async insert(state: VersionedOrganisation): Promise<number> {
    const row = { ...state, ...auditRow(stampCreation(this.scope, this.clock)) };

    const inserted = await insertIgnoringConflict(this.database.executor(), tableOf(this.database), {
      row,
      conflict: 'id',
    });

    return inserted ? 1 : 0;
  }

  private async update(state: VersionedOrganisation, expected: number): Promise<number> {
    return tableOf(this.database)
      .where({ id: state.id, version: expected })
      .update({ ...state, ...auditRow(stampUpdate(this.scope, this.clock)) });
  }
}

/** A function and not a method: a query builder is thenable, and a method that answers one is read as asynchronous by whatever wraps the adapter (tracing), which then answers a promise. */
function tableOf(database: KnexContext): Knex.QueryBuilder<OrganisationRow, OrganisationRow[]> {
  const table = database.executor()<OrganisationRow, OrganisationRow[]>('organisations');

  return table.withSchema({{context.constant}}_SCHEMA);
}
