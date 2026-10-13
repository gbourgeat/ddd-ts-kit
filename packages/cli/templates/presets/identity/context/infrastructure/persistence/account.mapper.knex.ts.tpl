import { Account } from '{{alias.context}}/domain/aggregates/account.aggregate{{alias.ext}}';
import { DisplayName } from '{{alias.context}}/domain/value-objects/display-name.vo{{alias.ext}}';
import { EmailAddress } from '{{alias.context}}/domain/value-objects/email-address.vo{{alias.ext}}';
import type { AccountColumns, AccountRow } from '{{alias.context}}/infrastructure/persistence/account-row.schema{{alias.ext}}';

export const AccountMapper = {
  toDomain(row: AccountRow): Account {
    const loaded = Account.rehydrate(row.id, {
      email: EmailAddress.create(row.email),
      displayName: DisplayName.create(row.display_name),
      status: row.status,
      provisionedAt: row.provisioned_at,
      deactivatedAt: row.deactivated_at ?? undefined,
    });

    loaded.version = row.version;

    return loaded;
  },

  toRow(saved: Account): AccountColumns {
    const state = saved.toState();

    return {
      id: saved.id,
      email: state.email.value,
      display_name: state.displayName.value,
      status: state.status,
      provisioned_at: state.provisionedAt,
      deactivated_at: state.deactivatedAt ?? null,
    };
  },
};
