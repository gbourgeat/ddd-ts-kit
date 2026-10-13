import { describe, expect, it } from '{{tests.module}}';
import { given } from '@ddd-ts-kit/testing';
import { Account } from '{{alias.context}}/domain/aggregates/account.aggregate{{alias.ext}}';
import { DisplayName } from '{{alias.context}}/domain/value-objects/display-name.vo{{alias.ext}}';
import { EmailAddress } from '{{alias.context}}/domain/value-objects/email-address.vo{{alias.ext}}';
import { anAccount } from '{{alias.context}}/test/builders/account.builder{{alias.ext}}';

const signedIn = new Date('2026-02-01T00:00:00.000Z');
const later = new Date('2026-02-02T00:00:00.000Z');
const profile = { email: EmailAddress.create('ada@example.test'), displayName: DisplayName.create('Ada Lovelace') };

describe('Account', () => {
  it('is provisioned under the subject of the provider, active, and announces who it is', () => {
    const account = Account.provision('subject-ada', profile, signedIn);

    expect(account.id).toBe('subject-ada');
    expect(account.isActive).toBe(true);

    expect(account.pullEvents()).toEqual([
      {
        name: '{{context.kebab}}.account.provisioned',
        aggregateId: 'subject-ada',
        occurredAt: signedIn,
        facts: { email: 'ada@example.test', displayName: 'Ada Lovelace' },
      },
    ]);
  });

  it('is rehydrated in its stored state without recording a new fact', () => {
    const stored = anAccount().build();
    const loaded = Account.rehydrate(stored.id, stored.toState());

    expect(loaded.toState()).toEqual(stored.toState());
    expect(loaded.pullEvents()).toEqual([]);
  });
});

describe('An active account', () => {
  it('takes the profile the provider holds at a later sign-in, silently', () => {
    const renamed = { email: EmailAddress.create('ada@lovelace.test'), displayName: DisplayName.create('Countess') };

    given(anAccount())
      .when((account) => account.refreshProfile(renamed))
      .thenNoEvent()
      .thenState((account) => expect([account.email.value, account.displayName.value]).toEqual(['ada@lovelace.test', 'Countess']));
  });

  it('is deactivated once, and announces it', () => {
    given(anAccount().identifiedBy('subject-ada'))
      .when((account) => account.deactivate(later))
      .thenEvents([{ name: '{{context.kebab}}.account.deactivated', aggregateId: 'subject-ada', occurredAt: later }])
      .thenState((account) => expect(account.isActive).toBe(false));
  });
});

describe('A deactivated account', () => {
  it('refuses to be deactivated again', () => {
    given(anAccount().deactivatedAt(signedIn))
      .when((account) => account.deactivate(later))
      .thenError('ACCOUNT_ALREADY_DEACTIVATED');
  });

  it('refuses a new profile, and every intention that asks it to be active', () => {
    given(anAccount().deactivatedAt(signedIn))
      .when((account) => account.refreshProfile(profile))
      .thenError('ACCOUNT_DEACTIVATED');

    given(anAccount().deactivatedAt(signedIn))
      .when((account) => account.assertActive())
      .thenError('ACCOUNT_DEACTIVATED');
  });
});
