{{#if access.protected}}
import { AuthorizedCommand } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Requires } from '@ddd-ts-kit/kernel/declarations';
{{access.useCasePermissionsImport}}
{{/if}}

{{#if style.declared}}
@{{access.decoration}}
{{/if}}
export class {{name.pascal}}Command extends AuthorizedCommand<{{command.result}}> {
{{#if access.resourceUnnamed}}
  // {{access.resourceTodo}}
{{/if}}
  // TODO(domain): declare the input of "{{name.words}}" as a constructor with the actor first, then readonly primitives and ids, for example `constructor(actor: Actor, readonly customerId: string) { super(actor); }`; the handler turns them into value objects.
}
{{/if}}
{{#if access.public}}
import { Command } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Public } from '@ddd-ts-kit/kernel/declarations';
{{/if}}

{{#if style.declared}}
@Public()
{{/if}}
export class {{name.pascal}}Command extends Command<{{command.result}}> {
  // TODO(domain): declare the input of "{{name.words}}" as a constructor with readonly primitives and ids, for example `constructor(readonly customerId: string) { super(); }`; the handler turns them into value objects.
}
{{/if}}
