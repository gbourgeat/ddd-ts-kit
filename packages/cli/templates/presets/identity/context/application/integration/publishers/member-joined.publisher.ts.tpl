import type { IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { MemberJoined } from '{{alias.context}}/domain/events/member-joined.event{{alias.ext}}';
import { memberJoinedV1 } from '{{alias.context}}/published-language/member-joined.v1.integration-event{{alias.ext}}';

/** Tells the other contexts, through the outbox, in the transaction of the fact. */
@DomainEventHandler(MemberJoined, { name: MemberJoined.eventName })
export class MemberJoinedPublisher implements DomainEventHandler<MemberJoined> {
  constructor(
    private readonly publisher: IntegrationEventPublisher,
    private readonly ids: IdGenerator,
  ) {}

  async handle(event: MemberJoined): Promise<void> {
    const published = memberJoinedV1.create(
      {
        memberId: event.aggregateId,
        organisationId: event.facts.organisationId,
        accountId: event.facts.accountId,
        role: event.facts.role,
      },
      { id: this.ids.next(), occurredAt: event.occurredAt },
    );

{{#if tenancy.any}}
    // The organisation is the tenant of the fact: its consumers run in it, whoever acted.
    await this.publisher.publish([{ ...published, tenantId: event.facts.organisationId }]);
{{/if}}
{{#unless tenancy.any}}
    await this.publisher.publish([published]);
{{/unless}}
  }
}
