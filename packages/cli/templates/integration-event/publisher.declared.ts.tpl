import type { IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { {{event.pascal}} } from '{{alias.context}}/domain/events/{{event.kebab}}.event{{alias.ext}}';
import { {{event.camel}}V{{event.version}} } from '{{alias.context}}/published-language/{{event.kebab}}.v{{event.version}}.integration-event{{alias.ext}}';

@DomainEventHandler({{event.pascal}}, { name: {{event.reference}} })
export class {{publisher.pascal}}Publisher implements DomainEventHandler<{{event.pascal}}> {
  constructor(
    private readonly publisher: IntegrationEventPublisher,
    private readonly ids: IdGenerator,
  ) {}

  async handle(event: {{event.pascal}}): Promise<void> {
    const published = {{event.camel}}V{{event.version}}.create(
      {
        {{aggregate.camel}}Id: event.aggregateId,
        // TODO(domain): map each fact of the domain event to its field of the public payload, as primitives; leave out what other contexts must not depend on.
      },
      { id: this.ids.next(), occurredAt: event.occurredAt },
    );

    await this.publisher.publish([published]);
  }
}
