import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { {{event.pascal}} } from '../../domain/events/{{event.kebab}}.event.js';

@DomainEventHandler({{event.pascal}}, { name: '{{event.name}}'{{#if handler.afterCommit}}, phase: 'after-commit'{{/if}} })
export class {{event.pascal}}EventHandler implements DomainEventHandler<{{event.pascal}}> {
  async handle(event: {{event.pascal}}): Promise<void> {
{{#unless handler.afterCommit}}
    // TODO(domain): state the policy "when {{event.words}}, then ..." and carry it out by executing a command of this context (name `CommandBus` of the kernel in the dependency list and receive it in the constructor). It runs at the end of the unit of work, before the commit: depend only on what the transaction covers; an effect outside the database belongs in the after-commit phase or, when it must not be lost, behind an integration event, where a reaction in another context goes too.
{{/unless}}
{{#if handler.afterCommit}}
    // TODO(domain): state the effect "once {{event.words}} is committed, then ..." and carry it out through its port (name the port in the dependency list and receive it in the constructor). It runs after the commit, at most once: a failure is reported and never fails the command, and a crash loses it, so what must not be lost goes through an integration event instead. It never saves an aggregate: a state change is a command sent through `CommandBus`.
{{/if}}
  }
}
