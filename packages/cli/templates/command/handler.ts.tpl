{{#if command.hasAggregate}}
{{#if access.policy}}
import type { Access } from '@ddd-ts-kit/auth';
{{/if}}
import type { Clock, CommandHandler, IdGenerator } from '@ddd-ts-kit/kernel';
import { {{aggregate.pascal}} } from '{{alias.context}}/domain/aggregates/{{aggregate.kebab}}.aggregate{{alias.ext}}';
import type { {{aggregate.pascal}}Repository } from '{{alias.context}}/domain/repositories/{{aggregate.kebab}}.repository{{alias.ext}}';
{{#if access.policy}}
{{access.useCasePermissionsImport}}
{{/if}}
import type { {{name.pascal}}Command } from '{{alias.context}}/application/commands/{{name.kebab}}/{{name.kebab}}.command{{alias.ext}}';

export class {{name.pascal}}Handler implements CommandHandler<{{name.pascal}}Command> {
  constructor(
    private readonly {{aggregate.camel}}Repository: {{aggregate.pascal}}Repository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
{{#if access.policy}}
    private readonly access: Access,
{{/if}}
  ) {}

  async execute(command: {{name.pascal}}Command): Promise<string> {
{{#if access.policy}}
    // TODO(domain): a policy refines {{access.reference}}: ask it about the element "{{name.words}}" acts on once it is loaded, in place of `command`.
    await this.access.authorize(command.actor, {{access.reference}}, command);

{{/if}}
{{#if refusals.factories}}
    // TODO(domain): decide what "{{name.words}}" does to a {{aggregate.pascal}}: either it gives birth to one (keep `create`, pass the facts of `command` as value objects), or it changes an existing one (load it with `findById`, throw its not-found refusal, `{{aggregate.pascal}}Error.notFound(id)` (`ddd-ts-kit generate error {{context.kebab}} {{aggregate.pascal}} notFound`), call ONE intention method). The events it records leave with the save: nothing else to do here.
{{/if}}
{{#if refusals.classes}}
    // TODO(domain): decide what "{{name.words}}" does to a {{aggregate.pascal}}: either it gives birth to one (keep `create`, pass the facts of `command` as value objects), or it changes an existing one (load it with `findById`, throw a not-found DomainError, call ONE intention method). The events it records leave with the save: nothing else to do here.
{{/if}}
    const {{aggregate.camel}} = {{aggregate.pascal}}.create(this.ids.next(), this.clock.now());

    await this.{{aggregate.camel}}Repository.save({{aggregate.camel}});

    return {{aggregate.camel}}.id;
  }
}
{{/if}}
{{#unless command.hasAggregate}}
{{#if access.policy}}
import type { Access } from '@ddd-ts-kit/auth';
{{/if}}
import type { CommandHandler } from '@ddd-ts-kit/kernel';
{{#if access.policy}}
{{access.useCasePermissionsImport}}
{{/if}}
import type { {{name.pascal}}Command } from '{{alias.context}}/application/commands/{{name.kebab}}/{{name.kebab}}.command{{alias.ext}}';

export class {{name.pascal}}Handler implements CommandHandler<{{name.pascal}}Command> {
{{#if access.policy}}
  constructor(private readonly access: Access) {}

{{/if}}
  async execute(command: {{name.pascal}}Command): Promise<void> {
{{#if access.policy}}
    // TODO(domain): a policy refines {{access.reference}}: ask it about the element "{{name.words}}" acts on once it is loaded, in place of `command`.
    await this.access.authorize(command.actor, {{access.reference}}, command);

{{/if}}
    // TODO(domain): receive the repository of the aggregate "{{name.words}}" acts on in the constructor (rerun with --aggregate <Name> --force to get it wired), load or create the aggregate from `command`, call its intention method and save it (its events leave with the save); the unit of work is opened by the command bus.
  }
}
{{/unless}}
