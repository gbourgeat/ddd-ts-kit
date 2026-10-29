{{#unless handler.afterCommit}}
import type { CommandBus } from '@ddd-ts-kit/kernel';
{{/unless}}
import type { {{event.pascal}} } from '{{alias.context}}/domain/events/{{event.kebab}}.event{{alias.ext}}';

export class {{handler.pascal}}EventHandler {
  {{#unless handler.afterCommit}}
  constructor(private readonly commands: CommandBus) {}

  {{/unless}}
  async handle(event: {{event.pascal}}): Promise<void> {
    {{#unless handler.afterCommit}}
    // TODO(domain): state the policy "when {{event.words}}, then ..." and carry it out by executing a command of this context, `await this.commands.execute(new ...Command(...))`. It runs at the end of the unit of work, before the commit: depend only on what the transaction covers; an effect outside the database belongs in the after-commit phase or, when it must not be lost, behind an integration event, where a reaction in another context goes too.
    {{/unless}}
    {{#if handler.afterCommit}}
    // TODO(domain): state the effect "once {{event.words}} is committed, then ..." and carry it out through its port (inject it through the constructor). It runs after the commit, at most once: a failure is reported and never fails the command, and a crash loses it, so what must not be lost goes through an integration event instead. It never saves an aggregate: a state change is a command sent through the command bus.
    {{/if}}
  }
}
