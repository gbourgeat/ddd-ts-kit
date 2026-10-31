{{#if command.births}}
{{#if access.policy}}
import type { Access } from '@ddd-ts-kit/auth';
{{/if}}
import type { Clock, IdGenerator } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { {{aggregate.pascal}} } from '{{alias.context}}/domain/aggregates/{{aggregate.kebab}}.aggregate{{alias.ext}}';
import type { {{aggregate.pascal}}Repository } from '{{alias.context}}/domain/repositories/{{aggregate.kebab}}.repository{{alias.ext}}';
{{#if access.policy}}
{{access.useCasePermissionsImport}}
{{/if}}
import { {{name.pascal}}Command } from '{{alias.context}}/application/commands/{{name.kebab}}/{{name.kebab}}.command{{alias.ext}}';

@CommandHandler({{name.pascal}}Command)
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
    // TODO(domain): decide what "{{name.words}}" does to {{aggregate.article}} {{aggregate.pascal}}: keep `create` and pass the facts of `command` as value objects. The events it records leave with the save: nothing else to do here.
    const {{aggregate.camel}} = {{aggregate.pascal}}.create(this.ids.next(), this.clock.now());

    await this.{{aggregate.camel}}Repository.save({{aggregate.camel}});

    return {{aggregate.camel}}.id;
  }
}
{{/if}}
{{#if command.changes}}
{{#if access.policy}}
import type { Access } from '@ddd-ts-kit/auth';
{{/if}}
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import type { {{aggregate.pascal}}Repository } from '{{alias.context}}/domain/repositories/{{aggregate.kebab}}.repository{{alias.ext}}';
{{#if access.policy}}
{{access.useCasePermissionsImport}}
{{/if}}
import { {{name.pascal}}Command } from '{{alias.context}}/application/commands/{{name.kebab}}/{{name.kebab}}.command{{alias.ext}}';

@CommandHandler({{name.pascal}}Command)
export class {{name.pascal}}Handler implements CommandHandler<{{name.pascal}}Command> {
{{#if access.policy}}
  constructor(
    private readonly {{aggregate.camel}}Repository: {{aggregate.pascal}}Repository,
    private readonly access: Access,
  ) {}
{{/if}}
{{#unless access.policy}}
  constructor(private readonly {{aggregate.camel}}Repository: {{aggregate.pascal}}Repository) {}
{{/unless}}

  async execute(command: {{name.pascal}}Command): Promise<void> {
{{#if access.policy}}
    // TODO(domain): a policy refines {{access.reference}}: ask it about the element "{{name.words}}" acts on once it is loaded, in place of `command`.
    await this.access.authorize(command.actor, {{access.reference}}, command);

{{/if}}
{{#if refusals.named}}
    // TODO(domain): "{{name.words}}" changes {{aggregate.pascal}}s that exist and writes nothing until you decide how: load the one `command` names with `this.{{aggregate.camel}}Repository.findById`, throw its refusal when there is none, `Unknown{{aggregate.pascal}}.for{{aggregate.pascal}}(id)` (`ddd-ts-kit generate error {{context.kebab}} Unknown{{aggregate.pascal}} for{{aggregate.pascal}}`), call ONE intention method of the aggregate, then `save` it (its events leave with the save).
{{/if}}
{{#if refusals.factories}}
    // TODO(domain): "{{name.words}}" changes {{aggregate.pascal}}s that exist and writes nothing until you decide how: load the one `command` names with `this.{{aggregate.camel}}Repository.findById`, throw its not-found refusal, `{{aggregate.pascal}}Error.notFound(id)` (`ddd-ts-kit generate error {{context.kebab}} {{aggregate.pascal}} notFound`), call ONE intention method of the aggregate, then `save` it (its events leave with the save).
{{/if}}
{{#if refusals.classes}}
    // TODO(domain): "{{name.words}}" changes {{aggregate.pascal}}s that exist and writes nothing until you decide how: load the one `command` names with `this.{{aggregate.camel}}Repository.findById`, throw a not-found DomainError, call ONE intention method of the aggregate, then `save` it (its events leave with the save).
{{/if}}
  }
}
{{/if}}
{{#unless command.hasAggregate}}
{{#if access.policy}}
import type { Access } from '@ddd-ts-kit/auth';
{{/if}}
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
{{#if access.policy}}
{{access.useCasePermissionsImport}}
{{/if}}
import { {{name.pascal}}Command } from '{{alias.context}}/application/commands/{{name.kebab}}/{{name.kebab}}.command{{alias.ext}}';

@CommandHandler({{name.pascal}}Command)
export class {{name.pascal}}Handler implements CommandHandler<{{name.pascal}}Command> {
{{#if access.policy}}
  constructor(private readonly access: Access) {}

{{/if}}
  async execute(command: {{name.pascal}}Command): Promise<void> {
{{#if access.policy}}
    // TODO(domain): a policy refines {{access.reference}}: ask it about the element "{{name.words}}" acts on once it is loaded, in place of `command`.
    await this.access.authorize(command.actor, {{access.reference}}, command);

{{/if}}
    // TODO(domain): receive the repository of the aggregate "{{name.words}}" acts on in the constructor, typed by its port (rerun with --aggregate <Name> --force to get it declared), load or create the aggregate from `command`, call its intention method and save it (its events leave with the save); the unit of work is opened by the command bus.
  }
}
{{/unless}}
