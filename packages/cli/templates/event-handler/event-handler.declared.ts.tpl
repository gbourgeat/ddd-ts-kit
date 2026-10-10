import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { {{event.pascal}} } from '../../domain/events/{{event.kebab}}.event.js';

@DomainEventHandler({{event.pascal}}, { name: '{{event.name}}' })
export class {{event.pascal}}EventHandler implements DomainEventHandler<{{event.pascal}}> {
  async handle(event: {{event.pascal}}): Promise<void> {
    // TODO(domain): state the policy "when {{event.words}}, then ..." and carry it out by executing a command of this context (name `CommandBus` of the kernel in the dependency list and receive it in the constructor); a reaction in another context goes through an integration event instead.
  }
}
