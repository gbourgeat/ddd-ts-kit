import type { IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
{{#if style.declared}}
import { MemberJoined } from '{{alias.context}}/domain/events/member-joined.event{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import type { MemberJoined } from '{{alias.context}}/domain/events/member-joined.event{{alias.ext}}';
{{/unless}}
import { memberJoinedV1 } from '{{alias.context}}/published-language/member-joined.v1.integration-event{{alias.ext}}';

/** Tells the other contexts, through the outbox, in the transaction of the fact. */
{{#if style.declared}}
@DomainEventHandler(MemberJoined)
{{/if}}
export class MemberJoinedPublisher{{#if style.declared}} implements DomainEventHandler<MemberJoined>{{/if}} {
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
