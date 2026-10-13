import type { DomainEvent } from '@ddd-ts-kit/kernel';

/** An account was provisioned at the first sign-in of its person. */
export class AccountProvisioned implements DomainEvent {
  static readonly eventName = '{{context.kebab}}.account.provisioned';

  readonly name = AccountProvisioned.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly facts: {
      readonly email: string;
      readonly displayName: string;
    },
  ) {}
}
