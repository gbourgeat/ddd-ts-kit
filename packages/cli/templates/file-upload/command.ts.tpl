{{#if access.protected}}
import { AuthorizedCommand, FileUpload, type Actor, type ReceivedFile } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Requires } from '@ddd-ts-kit/kernel/declarations';
{{access.useCasePermissionsImport}}
{{/if}}

{{#if style.declared}}
@{{access.decoration}}
{{/if}}
export class {{name.pascal}}Command extends AuthorizedCommand<string> {
  /** Staged by the bus under a key of its area before the transaction opens: the handler reads `upload.file`. */
  readonly upload: FileUpload;

{{#if access.resourceUnnamed}}
  // {{access.resourceTodo}}
{{/if}}
  // TODO(domain): add the identifier of what the file is attached to, read from the path by the controller, for example `readonly invoiceId: string`.
  constructor(actor: Actor, file: ReceivedFile) {
    super(actor);
    this.upload = new FileUpload(file, '{{name.kebab}}');
  }
}
{{/if}}
{{#if access.public}}
import { Command, FileUpload, type ReceivedFile } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Public } from '@ddd-ts-kit/kernel/declarations';
{{/if}}

{{#if style.declared}}
@Public()
{{/if}}
export class {{name.pascal}}Command extends Command<string> {
  /** Staged by the bus under a key of its area before the transaction opens: the handler reads `upload.file`. */
  readonly upload: FileUpload;

  // TODO(domain): add the identifier of what the file is attached to, read from the path by the controller, for example `readonly invoiceId: string`.
  constructor(file: ReceivedFile) {
    super();
    this.upload = new FileUpload(file, '{{name.kebab}}');
  }
}
{{/if}}
