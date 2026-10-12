{{#if command.hasAggregate}}
import type { Clock, IdGenerator } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { {{aggregate.pascal}} } from '{{alias.context}}/domain/aggregates/{{aggregate.kebab}}.aggregate{{alias.ext}}';
import type { {{aggregate.pascal}}Repository } from '{{alias.context}}/domain/repositories/{{aggregate.kebab}}.repository{{alias.ext}}';
import { {{name.pascal}}Command } from '{{alias.context}}/application/commands/{{name.kebab}}/{{name.kebab}}.command{{alias.ext}}';

@CommandHandler({{name.pascal}}Command)
export class {{name.pascal}}Handler implements CommandHandler<{{name.pascal}}Command> {
  constructor(
    private readonly {{aggregate.camel}}Repository: {{aggregate.pascal}}Repository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: {{name.pascal}}Command): Promise<string> {
    // TODO(domain): decide what "{{name.words}}" does to a {{aggregate.pascal}}: either it gives birth to one (keep `create`, pass the facts of `command` as value objects), or it changes an existing one (load it with `findById`, throw a not-found DomainError, call ONE intention method). The events it records leave with the save: nothing else to do here.
    const target = {{aggregate.pascal}}.create(this.ids.next(), this.clock.now());

    await this.{{aggregate.camel}}Repository.save(target);

    return target.id;
  }
}
{{/if}}
{{#unless command.hasAggregate}}
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { {{name.pascal}}Command } from '{{alias.context}}/application/commands/{{name.kebab}}/{{name.kebab}}.command{{alias.ext}}';

@CommandHandler({{name.pascal}}Command)
export class {{name.pascal}}Handler implements CommandHandler<{{name.pascal}}Command> {
  async execute(command: {{name.pascal}}Command): Promise<void> {
    // TODO(domain): receive the repository of the aggregate "{{name.words}}" acts on in the constructor, typed by its port (rerun with --aggregate <Name> --force to get it declared), load or create the aggregate from `command`, call its intention method and save it (its events leave with the save); the unit of work is opened by the command bus.
  }
}
{{/unless}}
