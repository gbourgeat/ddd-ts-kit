import { NamedDomainEvent } from '@ddd-ts-kit/kernel';

/** An account was deactivated: its person signs in no more. */
export class AccountDeactivated extends NamedDomainEvent('{{context.kebab}}.account.deactivated') {
  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
  ) {
    super();
  }
}
