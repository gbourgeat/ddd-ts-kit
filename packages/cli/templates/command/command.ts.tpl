{{#if access.protected}}
import { AuthorizedCommand } from '@ddd-ts-kit/kernel';

export class {{name.pascal}}Command extends AuthorizedCommand<{{command.result}}> {
  // TODO(domain): declare the input of "{{name.words}}" as a constructor with the actor first, then readonly primitives and ids, for example `constructor(actor: Actor, readonly customerId: string) { super(actor); }`; the handler turns them into value objects.
}
{{/if}}
{{#if access.public}}
import { Command } from '@ddd-ts-kit/kernel';

export class {{name.pascal}}Command extends Command<{{command.result}}> {
  // TODO(domain): declare the input of "{{name.words}}" as a constructor with readonly primitives and ids, for example `constructor(readonly customerId: string) { super(); }`; the handler turns them into value objects.
}
{{/if}}
