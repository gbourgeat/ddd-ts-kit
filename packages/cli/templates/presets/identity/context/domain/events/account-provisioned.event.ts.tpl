import { NamedDomainEvent } from '@ddd-ts-kit/kernel';

/** An account was provisioned at the first sign-in of its person. */
export class AccountProvisioned extends NamedDomainEvent('{{context.kebab}}.account.provisioned') {
  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly facts: {
      readonly email: string;
      readonly displayName: string;
    },
  ) {
    super();
  }
}
