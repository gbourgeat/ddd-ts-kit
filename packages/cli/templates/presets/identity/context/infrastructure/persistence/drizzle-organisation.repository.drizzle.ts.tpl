import { and, eq } from 'drizzle-orm';
import { optimisticUpdate } from '@ddd-ts-kit/drizzle/postgres';
import { stampCreation, stampUpdate, type Clock, type ExecutionScope } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import type { Organisation } from '{{alias.context}}/domain/aggregates/organisation.aggregate{{alias.ext}}';
import { OrganisationRepository } from '{{alias.context}}/domain/repositories/organisation.repository{{alias.ext}}';
import type { Database } from '{{alias.platform}}/database/database{{alias.ext}}';
import { organisations } from '{{alias.context}}/infrastructure/persistence/{{context.kebab}}.schema{{alias.ext}}';
import { OrganisationMapper, type OrganisationColumns } from '{{alias.context}}/infrastructure/persistence/organisation.mapper{{alias.ext}}';

type VersionedOrganisation = OrganisationColumns & { readonly version: number };

@Repository(OrganisationRepository)
export class DrizzleOrganisationRepository implements OrganisationRepository {
  constructor(
    private readonly database: Database,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Organisation | undefined> {
    const [row] = await executorOf(this.database).select().from(organisations).where(eq(organisations.id, id));

    return row === undefined ? undefined : OrganisationMapper.toDomain(row);
  }

  async save(saved: Organisation): Promise<void> {
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...OrganisationMapper.toRow(saved), version: next };
      const written = expected === 0 ? await this.insert(state) : await this.update(state, expected);

      return written.length;
    });
  }

  private insert(state: VersionedOrganisation) {
    const row = { ...state, ...stampCreation(this.scope, this.clock) };

    return executorOf(this.database).insert(organisations).values(row).onConflictDoNothing().returning({ id: organisations.id });
  }

  private update(state: VersionedOrganisation, expected: number) {
    const sameVersion = and(eq(organisations.id, state.id), eq(organisations.version, expected));

    return executorOf(this.database)
      .update(organisations)
      .set({ ...state, ...stampUpdate(this.scope, this.clock) })
      .where(sameVersion)
      .returning({ id: organisations.id });
  }
}

/** The executor of the unit of work, which every statement of this file goes through. */
function executorOf(database: Database): ReturnType<Database['executor']> {
{{#if tenancy.any}}
  // ddd-ts-kit-disable-next-line tenancy/scoped-statement -- {{preset.adr}}: the {{context.kebab}} context is the control plane of the tenants, and its rows belong to none of them.
{{/if}}
  return database.executor();
}
