{{#if command.hasAggregate}}
import type { Clock, DomainEventDispatcher, IdGenerator } from '@ddd-ts-kit/kernel';
import { CLOCK, CommandHandler, DOMAIN_EVENTS, ID_GENERATOR } from '@ddd-ts-kit/kernel/declarations';
import { {{aggregate.pascal}} } from '../../../domain/aggregates/{{aggregate.kebab}}.aggregate.js';
import type { {{aggregate.pascal}}Repository } from '../../../domain/repositories/{{aggregate.kebab}}.repository.js';
import { {{aggregate.constant}}_REPOSITORY } from '../../ports/{{context.kebab}}.ports.js';
import { {{name.pascal}}Command } from './{{name.kebab}}.command.js';

@CommandHandler({{name.pascal}}Command, [{{aggregate.constant}}_REPOSITORY, DOMAIN_EVENTS, ID_GENERATOR, CLOCK])
export class {{name.pascal}}Handler implements CommandHandler<{{name.pascal}}Command> {
  constructor(
    private readonly {{aggregate.camel}}Repository: {{aggregate.pascal}}Repository,
    private readonly domainEvents: DomainEventDispatcher,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: {{name.pascal}}Command): Promise<string> {
    // TODO(domain): decide what "{{name.words}}" does to a {{aggregate.pascal}}: either it gives birth to one (keep `create`, pass the facts of `command` as value objects), or it changes an existing one (load it with `findById`, throw a not-found DomainError, call the intention method).
    const target = {{aggregate.pascal}}.create(this.ids.next(), this.clock.now());
    await this.{{aggregate.camel}}Repository.save(target);
    await this.domainEvents.dispatch(target.pullEvents());
    return target.id;
  }
}
{{/if}}
{{#unless command.hasAggregate}}
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { {{name.pascal}}Command } from './{{name.kebab}}.command.js';

@CommandHandler({{name.pascal}}Command)
export class {{name.pascal}}Handler implements CommandHandler<{{name.pascal}}Command> {
  async execute(command: {{name.pascal}}Command): Promise<void> {
    // TODO(domain): inject the repository of the aggregate "{{name.words}}" acts on (rerun with --aggregate <Name> --force to get it declared), load or create the aggregate from `command`, call its intention method, save it and dispatch its events; the unit of work is opened by the command bus.
  }
}
{{/unless}}
