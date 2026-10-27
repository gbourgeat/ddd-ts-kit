import { and, eq } from 'drizzle-orm';
import { optimisticUpdate } from '@ddd-ts-kit/drizzle/postgres';
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
import { accounts } from '{{alias.context}}/infrastructure/persistence/{{context.kebab}}.schema{{alias.ext}}';
import { AccountMapper, type AccountColumns } from '{{alias.context}}/infrastructure/persistence/account.mapper{{alias.ext}}';

type VersionedAccount = AccountColumns & { readonly version: number };

{{#if style.declared}}
@Repository(AccountRepository)
{{/if}}
export class DrizzleAccountRepository implements AccountRepository {
  constructor(
    private readonly database: Database,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Account | undefined> {
    const [row] = await executorOf(this.database).select().from(accounts).where(eq(accounts.id, id));

    return row === undefined ? undefined : AccountMapper.toDomain(row);
  }

  async save(saved: Account): Promise<void> {
    await optimisticUpdate(saved, async ({ expected, next }) => {
      const state = { ...AccountMapper.toRow(saved), version: next };
      const written = expected === 0 ? await this.insert(state) : await this.update(state, expected);

      return written.length;
    });
  }

  private insert(state: VersionedAccount) {
    const row = { ...state, ...stampCreation(this.scope, this.clock) };

    return executorOf(this.database).insert(accounts).values(row).onConflictDoNothing().returning({ id: accounts.id });
  }

  private update(state: VersionedAccount, expected: number) {
    const sameVersion = and(eq(accounts.id, state.id), eq(accounts.version, expected));

    return executorOf(this.database)
      .update(accounts)
      .set({ ...state, ...stampUpdate(this.scope, this.clock) })
      .where(sameVersion)
      .returning({ id: accounts.id });
  }
}

/** The executor of the unit of work, which every statement of this file goes through. */
function executorOf(database: Database): ReturnType<Database['executor']> {
  return database.executor();
}
