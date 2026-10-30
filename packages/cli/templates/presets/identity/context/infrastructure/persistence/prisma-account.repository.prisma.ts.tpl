import { optimisticUpdate, rowsCreated } from '@ddd-ts-kit/prisma';
import { stampCreation, stampUpdate, type Clock, type ExecutionScope } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Repository } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
import type { Account } from '{{alias.context}}/domain/aggregates/account.aggregate{{alias.ext}}';
{{#if style.declared}}
import { AccountRepository } from '{{alias.context}}/domain/repositories/account.repository{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import type { AccountRepository } from '{{alias.context}}/domain/repositories/account.repository{{alias.ext}}';
{{/unless}}
import type { Database } from '{{alias.platform}}/database/database{{alias.ext}}';
import { AccountMapper, type AccountColumns } from '{{alias.context}}/infrastructure/persistence/account.mapper{{alias.ext}}';

type VersionedAccount = AccountColumns & { readonly version: number };

{{#if style.declared}}
@Repository(AccountRepository)
{{/if}}
export class PrismaAccountRepository implements AccountRepository {
  constructor(
    private readonly database: Database,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Account | undefined> {
    const row = await accountsOf(this.database).findUnique({ where: { id } });

    return row === null ? undefined : AccountMapper.toDomain(row);
  }

  async save(saved: Account): Promise<void> {
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...AccountMapper.toRow(saved), version: next };

      return expected === 0 ? this.insert(state) : (await this.update(state, expected)).count;
    });
  }

  /** `skipDuplicates` skips a row that takes any unique value: `rowsCreated` tells a taken id from another value. */
  private async insert(state: VersionedAccount): Promise<number> {
    const row = { ...state, ...stampCreation(this.scope, this.clock) };
    const created = await accountsOf(this.database).createMany({ data: [row], skipDuplicates: true });

    return rowsCreated(created, {
      id: state.id,
      holders: () => accountsOf(this.database).count({ where: { id: state.id } }),
    });
  }

  private update(state: VersionedAccount, expected: number): Promise<{ count: number }> {
    return accountsOf(this.database).updateMany({
      where: { id: state.id, version: expected },
      data: { ...state, ...stampUpdate(this.scope, this.clock) },
    });
  }
}

/** The accounts on the client of the unit of work, which every statement of this file goes through. */
function accountsOf(database: Database): ReturnType<Database['client']>['{{context.camel}}Account'] {
  return database.client().{{context.camel}}Account;
}
