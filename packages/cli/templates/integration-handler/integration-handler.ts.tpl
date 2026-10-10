{{#if upstream.known}}
import { systemActor, type CommandBus } from '@ddd-ts-kit/kernel';
import type { {{upstream.eventType}} } from '{{alias.contexts}}/{{upstream.kebab}}/published-language/index.js';
{{/if}}
{{#unless upstream.known}}
import { systemActor, type CommandBus, type IntegrationEvent } from '@ddd-ts-kit/kernel';
{{/unless}}

export class {{name.pascal}}IntegrationHandler {
  static readonly eventType = '{{upstream.eventName}}';

  readonly actor = systemActor('{{context.kebab}}.{{name.kebab}}');

  constructor(private readonly commands: CommandBus) {}

  {{#if upstream.known}}
  async handle(event: {{upstream.eventType}}): Promise<void> {
    // TODO(domain): translate `event.payload` (the language of {{upstream.kebab}}) into a command of {{context.kebab}}, built with `this.actor` (nobody is calling: the handler acts as a system actor the authorization model has to grant), and execute it with `this.commands.execute(...)`; delivery is at least once, so the command has to be safe to repeat.
  }
  {{/if}}
  {{#unless upstream.known}}
  async handle(event: IntegrationEvent): Promise<void> {
    // TODO(domain): narrow `event.payload` (it is `unknown`: {{upstream.kebab}} declares no contract for this event in this repository), translate it into a command of {{context.kebab}}, built with `this.actor` (nobody is calling: the handler acts as a system actor the authorization model has to grant), and execute it with `this.commands.execute(...)`; delivery is at least once, so the command has to be safe to repeat.
  }
  {{/unless}}
}
