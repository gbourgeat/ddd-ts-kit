{{#if upstream.known}}
import type { CommandBus } from '@ddd-ts-kit/kernel';
import type { {{upstream.eventType}} } from '{{upstream.import}}';
{{/if}}
{{#unless upstream.known}}
import type { CommandBus, IntegrationEvent } from '@ddd-ts-kit/kernel';
{{/unless}}

export class {{name.pascal}}Consumer {
  static readonly eventType = '{{upstream.eventName}}';

  constructor(private readonly commands: CommandBus) {}

{{#if upstream.known}}
  async handle(event: {{upstream.eventType}}): Promise<void> {
    // TODO(domain): translate `event.payload` (the language of {{upstream.kebab}}) into a command of {{context.kebab}} and execute it with `this.commands.execute(...)`; delivery is at least once, so the command has to be safe to repeat.
  }
{{/if}}
{{#unless upstream.known}}
  async handle(event: IntegrationEvent): Promise<void> {
    // TODO(domain): narrow `event.payload` (it is `unknown`: {{upstream.kebab}} declares no contract for this event in this repository), translate it into a command of {{context.kebab}} and execute it with `this.commands.execute(...)`; delivery is at least once, so the command has to be safe to repeat.
  }
{{/unless}}
}
