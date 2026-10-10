import { CommandBus, systemActor } from '@ddd-ts-kit/kernel';
import { IntegrationEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { {{upstream.definition}}, type {{upstream.eventType}} } from '{{alias.contexts}}/{{upstream.kebab}}/published-language/index.js';

@IntegrationEventHandler({{upstream.definition}}, { consumer: '{{context.kebab}}.{{name.kebab}}' }, [CommandBus])
export class {{name.pascal}}IntegrationHandler {
  static readonly eventType = '{{upstream.eventName}}';

  readonly actor = systemActor('{{context.kebab}}.{{name.kebab}}');

  constructor(private readonly commands: CommandBus) {}

  async handle(event: {{upstream.eventType}}): Promise<void> {
    // TODO(domain): translate `event.payload` (the language of {{upstream.kebab}}) into a command of {{context.kebab}}, built with `this.actor` (nobody is calling: the handler acts as a system actor the authorization model has to grant), and execute it with `this.commands.execute(...)`; delivery is at least once, so the command has to be safe to repeat.
  }
}
