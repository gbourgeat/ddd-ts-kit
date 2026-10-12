{{#if access.protected}}
import { AuthorizedCommand, type Actor, type ReceivedFile } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Requires } from '@ddd-ts-kit/kernel/declarations';
{{access.useCasePermissionsImport}}
{{/if}}

{{#if style.declared}}
@{{access.decoration}}
{{/if}}
export class {{name.pascal}}Command extends AuthorizedCommand<string> {
  // TODO(domain): add the identifier of what the file is attached to, read from the path by the controller, for example `readonly invoiceId: string`.
  constructor(
    actor: Actor,
    readonly file: ReceivedFile,
  ) {
    super(actor);
  }
}
{{/if}}
{{#if access.public}}
import { Command, type ReceivedFile } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Public } from '@ddd-ts-kit/kernel/declarations';
{{/if}}

{{#if style.declared}}
@Public()
{{/if}}
export class {{name.pascal}}Command extends Command<string> {
  // TODO(domain): add the identifier of what the file is attached to, read from the path by the controller, for example `readonly invoiceId: string`.
  constructor(readonly file: ReceivedFile) {
    super();
  }
}
{{/if}}
