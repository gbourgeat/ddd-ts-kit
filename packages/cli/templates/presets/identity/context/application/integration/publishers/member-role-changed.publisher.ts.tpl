import type { IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
{{#if style.declared}}
import { MemberRoleChanged } from '{{alias.context}}/domain/events/member-role-changed.event{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import type { MemberRoleChanged } from '{{alias.context}}/domain/events/member-role-changed.event{{alias.ext}}';
{{/unless}}
import { memberRoleChangedV1 } from '{{alias.context}}/published-language/member-role-changed.v1.integration-event{{alias.ext}}';

/** Tells the other contexts, through the outbox, in the transaction of the fact. */
{{#if style.declared}}
@DomainEventHandler(MemberRoleChanged)
{{/if}}
export class MemberRoleChangedPublisher{{#if style.declared}} implements DomainEventHandler<MemberRoleChanged>{{/if}} {
  constructor(
    private readonly publisher: IntegrationEventPublisher,
    private readonly ids: IdGenerator,
  ) {}

  async handle(event: MemberRoleChanged): Promise<void> {
    const published = memberRoleChangedV1.create(
      {
        memberId: event.aggregateId,
        organisationId: event.facts.organisationId,
        accountId: event.facts.accountId,
        from: event.facts.from,
        to: event.facts.to,
        ...(event.facts.delegationId === undefined ? {} : { delegationId: event.facts.delegationId }),
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
