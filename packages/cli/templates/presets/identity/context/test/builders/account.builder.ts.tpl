import { Builder, sequence, type Defaults } from '@ddd-ts-kit/testing';
import { Account } from '{{alias.context}}/domain/aggregates/account.aggregate{{alias.ext}}';
import { DisplayName } from '{{alias.context}}/domain/value-objects/display-name.vo{{alias.ext}}';
import { EmailAddress } from '{{alias.context}}/domain/value-objects/email-address.vo{{alias.ext}}';

interface AccountIngredients {
  readonly subject: string;
  readonly email: string;
  readonly displayName: string;
  readonly provisionedAt: Date;
  readonly deactivatedAt: Date | undefined;
}

export class AccountBuilder extends Builder<AccountIngredients, Account> {
  identifiedBy(subject: string): this {
    return this.with('subject', subject);
  }

  reachedAt(email: string): this {
    return this.with('email', email);
  }

  named(displayName: string): this {
    return this.with('displayName', displayName);
  }

  provisionedAt(instant: Date): this {
    return this.with('provisionedAt', instant);
  }

  deactivatedAt(instant: Date): this {
    return this.with('deactivatedAt', instant);
  }

  protected defaults(): Defaults<AccountIngredients> {
    return {
      subject: sequence('account'),
      email: sequence('person', (n) => `person-${n}@example.test`),
      displayName: 'Ada Lovelace',
      provisionedAt: new Date('2026-01-01T00:00:00.000Z'),
      deactivatedAt: undefined,
    };
  }

  protected construct(ingredients: AccountIngredients): Account {
    const profile = { email: EmailAddress.create(ingredients.email), displayName: DisplayName.create(ingredients.displayName) };
    const account = Account.provision(ingredients.subject, profile, ingredients.provisionedAt);

    if (ingredients.deactivatedAt !== undefined) {
      account.deactivate(ingredients.deactivatedAt);
    }

    return account;
  }
}

export function anAccount(): AccountBuilder {
  return new AccountBuilder();
}
