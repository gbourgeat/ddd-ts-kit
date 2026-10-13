import type { DomainEvent } from '@ddd-ts-kit/kernel';

/** An organisation was opened, its opener its first owner. */
export class OrganisationOpened implements DomainEvent {
  static readonly eventName = '{{context.kebab}}.organisation.opened';

  readonly name = OrganisationOpened.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly facts: {
      readonly name: string;
      readonly openedBy: string;
    },
  ) {}
}
