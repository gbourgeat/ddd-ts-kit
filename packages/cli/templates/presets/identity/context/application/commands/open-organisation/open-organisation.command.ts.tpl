import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { {{context.camel}}Permissions } from '{{alias.context}}/application/authorization/{{context.kebab}}.permissions{{alias.ext}}';

/** Opens an organisation; the account that opens it is its first owner. */
@Requires({{context.camel}}Permissions['organisation.open'], { resource: () => ({ type: 'context', id: '{{context.kebab}}' }) })
export class OpenOrganisationCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly organisation: { readonly slug: string; readonly name: string },
  ) {
    super(actor);
  }
}
