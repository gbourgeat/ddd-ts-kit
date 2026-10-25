import type { IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
{{#if style.declared}}
import { AccountDeactivated } from '{{alias.context}}/domain/events/account-deactivated.event{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import type { AccountDeactivated } from '{{alias.context}}/domain/events/account-deactivated.event{{alias.ext}}';
{{/unless}}
import { accountDeactivatedV1 } from '{{alias.context}}/published-language/account-deactivated.v1.integration-event{{alias.ext}}';

/** Tells the other contexts, through the outbox, in the transaction of the fact. */
{{#if style.declared}}
@DomainEventHandler(AccountDeactivated)
{{/if}}
export class AccountDeactivatedPublisher{{#if style.declared}} implements DomainEventHandler<AccountDeactivated>{{/if}} {
  constructor(
    private readonly publisher: IntegrationEventPublisher,
    private readonly ids: IdGenerator,
  ) {}

  async handle(event: AccountDeactivated): Promise<void> {
    const published = accountDeactivatedV1.create(
      {
        accountId: event.aggregateId,
      },
      { id: this.ids.next(), occurredAt: event.occurredAt },
    );

    await this.publisher.publish([published]);
  }
}
