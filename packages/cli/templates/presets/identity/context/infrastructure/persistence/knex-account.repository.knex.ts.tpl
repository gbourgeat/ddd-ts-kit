import type { Knex } from 'knex';
import { stampCreation, stampUpdate, type Clock, type ExecutionScope } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { type KnexContext, auditRow, insertIgnoringConflict, optimisticUpdate } from '@ddd-ts-kit/knex';
import type { Account } from '{{alias.context}}/domain/aggregates/account.aggregate{{alias.ext}}';
import { AccountRepository } from '{{alias.context}}/domain/repositories/account.repository{{alias.ext}}';
import { {{context.constant}}_SCHEMA } from '{{alias.context}}/infrastructure/persistence/{{context.kebab}}.schema{{alias.ext}}';
import { AccountMapper } from '{{alias.context}}/infrastructure/persistence/account.mapper{{alias.ext}}';
import type { AccountColumns, AccountRow } from '{{alias.context}}/infrastructure/persistence/account-row.schema{{alias.ext}}';

type VersionedAccount = AccountColumns & { readonly version: number };

@Repository(AccountRepository)
export class KnexAccountRepository implements AccountRepository {
  constructor(
    private readonly database: KnexContext,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Account | undefined> {
    const row = await tableOf(this.database).where({ id }).first();

    return row === undefined ? undefined : AccountMapper.toDomain(row);
  }

  async save(saved: Account): Promise<void> {
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...AccountMapper.toRow(saved), version: next };

      return expected === 0 ? this.insert(state) : this.update(state, expected);
    });
  }

  private async insert(state: VersionedAccount): Promise<number> {
    const row = { ...state, ...auditRow(stampCreation(this.scope, this.clock)) };

    const inserted = await insertIgnoringConflict(this.database.executor(), tableOf(this.database), {
      row,
      conflict: 'id',
    });

    return inserted ? 1 : 0;
  }

  private async update(state: VersionedAccount, expected: number): Promise<number> {
    return tableOf(this.database)
      .where({ id: state.id, version: expected })
      .update({ ...state, ...auditRow(stampUpdate(this.scope, this.clock)) });
  }
}

/** A function and not a method: a query builder is thenable, and a method that answers one is read as asynchronous by whatever wraps the adapter (tracing), which then answers a promise. */
function tableOf(database: KnexContext): Knex.QueryBuilder<AccountRow, AccountRow[]> {
{{#if tenancy.any}}
  // ddd-ts-kit-disable-next-line tenancy/scoped-statement -- {{preset.adr}}: the {{context.kebab}} context is the control plane of the tenants, and its rows belong to none of them.
{{/if}}
  const table = database.executor()<AccountRow, AccountRow[]>('accounts');

  return table.withSchema({{context.constant}}_SCHEMA);
}
