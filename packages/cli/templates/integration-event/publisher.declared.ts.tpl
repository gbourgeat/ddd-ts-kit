import { IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { {{event.pascal}} } from '../../../domain/events/{{event.kebab}}.event.js';
import { {{event.camel}}V{{event.version}} } from '../../../published-language/{{event.kebab}}.v{{event.version}}.integration-event.js';

@DomainEventHandler({{event.pascal}}, { name: '{{event.name}}' }, [IntegrationEventPublisher, IdGenerator])
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
