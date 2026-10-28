import { type EntityManager } from 'typeorm';
import { stampCreation, stampUpdate, type Clock, type ExecutionScope } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Repository } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
import { type TypeOrmContext, insertIgnoringConflict, optimisticUpdate } from '@ddd-ts-kit/typeorm';
import type { Account } from '{{alias.context}}/domain/aggregates/account.aggregate{{alias.ext}}';
{{#if style.declared}}
import { AccountRepository } from '{{alias.context}}/domain/repositories/account.repository{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import type { AccountRepository } from '{{alias.context}}/domain/repositories/account.repository{{alias.ext}}';
{{/unless}}
import { accounts } from '{{alias.context}}/infrastructure/persistence/{{context.kebab}}.schema{{alias.ext}}';
import { AccountMapper } from '{{alias.context}}/infrastructure/persistence/account.mapper{{alias.ext}}';
import type { AccountColumns } from '{{alias.context}}/infrastructure/persistence/account-row.schema{{alias.ext}}';

type VersionedAccount = AccountColumns & { version: number };

{{#if style.declared}}
@Repository(AccountRepository)
{{/if}}
export class TypeOrmAccountRepository implements AccountRepository {
  constructor(
    private readonly database: TypeOrmContext,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Account | undefined> {
    const row = await managerOf(this.database).findOneBy(accounts, { id });

    return row === null ? undefined : AccountMapper.toDomain(row);
  }

  async save(saved: Account): Promise<void> {
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...AccountMapper.toRow(saved), version: next };

      return expected === 0 ? this.insert(state) : this.update(state, expected);
    });
  }

  private async insert(state: VersionedAccount): Promise<number> {
    const row = { ...state, ...stampCreation(this.scope, this.clock) };

    return (await insertIgnoringConflict(managerOf(this.database), accounts, row)) ? 1 : 0;
  }

  private async update(state: VersionedAccount, expected: number): Promise<number> {
    const row = { ...state, ...stampUpdate(this.scope, this.clock) };

    const updated = await managerOf(this.database).update(accounts, { id: state.id, version: expected }, row);

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
