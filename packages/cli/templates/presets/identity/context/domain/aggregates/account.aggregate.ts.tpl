import { AggregateRoot } from '@ddd-ts-kit/kernel';
{{#unless refusals.named}}
import { AccountError } from '{{alias.context}}/domain/errors/account.error{{alias.ext}}';
{{/unless}}
{{#if refusals.named}}
import { AccountAlreadyDeactivated } from '{{alias.context}}/domain/errors/account-already-deactivated.error{{alias.ext}}';
import { DeactivatedAccount } from '{{alias.context}}/domain/errors/deactivated-account.error{{alias.ext}}';
{{/if}}
import { AccountDeactivated } from '{{alias.context}}/domain/events/account-deactivated.event{{alias.ext}}';
import { AccountProvisioned } from '{{alias.context}}/domain/events/account-provisioned.event{{alias.ext}}';
import type { DisplayName } from '{{alias.context}}/domain/value-objects/display-name.vo{{alias.ext}}';
import type { EmailAddress } from '{{alias.context}}/domain/value-objects/email-address.vo{{alias.ext}}';
import { AccountStatus } from '{{alias.context}}/domain/vocabularies/account-status.vocabulary{{alias.ext}}';

/** What the identity provider says of a person, as the application keeps it: refreshed at each sign-in. */
export interface AccountProfile {
  readonly email: EmailAddress;
  readonly displayName: DisplayName;
}

export interface AccountState extends AccountProfile {
  readonly status: AccountStatus;
  readonly provisionedAt: Date;
  readonly deactivatedAt: Date | undefined;
}

/**
 * One person as the application knows them, under the subject the identity provider gives them:
 * the provider authenticates, the application keeps the profile and authorizes. No password is
 * stored here, nor anything the provider owns.
 */
export class Account extends AggregateRoot<string> {
  private constructor(
    id: string,
    private state: AccountState,
  ) {
    super(id);
  }

  /** At the first sign-in of a person: the account takes the subject of the provider as its identity. */
  static provision(subject: string, profile: AccountProfile, now: Date): Account {
    const status = AccountStatus.Active;
    const provisioned = new Account(subject, { ...profile, status, provisionedAt: now, deactivatedAt: undefined });

    provisioned.record(
      new AccountProvisioned(subject, now, { email: profile.email.value, displayName: profile.displayName.value }),
    );

    return provisioned;
  }

  static rehydrate(id: string, state: AccountState): Account {
    return new Account(id, state);
  }

  /** At a later sign-in: the profile the provider holds now replaces the one kept. */
  refreshProfile(profile: AccountProfile): void {
    this.assertActive();
    this.state = { ...this.state, ...profile };
  }

  /** The person signs in no more; their memberships and their history stay. */
  deactivate(now: Date): void {
    if (!this.isActive) {
{{#if refusals.named}}
      throw AccountAlreadyDeactivated.forAccount(this.id);
{{/if}}
{{#unless refusals.named}}
      throw AccountError.alreadyDeactivated(this.id);
{{/unless}}
    }

    this.state = { ...this.state, status: AccountStatus.Deactivated, deactivatedAt: now };
    this.record(new AccountDeactivated(this.id, now));
  }

  /** Refuses every intention of a deactivated account. */
  assertActive(): void {
    if (!this.isActive) {
{{#if refusals.named}}
      throw DeactivatedAccount.forAccount(this.id);
{{/if}}
{{#unless refusals.named}}
      throw AccountError.deactivated(this.id);
{{/unless}}
    }
  }

  get isActive(): boolean {
    return this.state.status === AccountStatus.Active;
  }

  get email(): EmailAddress {
    return this.state.email;
  }

  get displayName(): DisplayName {
    return this.state.displayName;
  }

  get provisionedAt(): Date {
    return this.state.provisionedAt;
  }

  toState(): AccountState {
    return { ...this.state };
  }
}
