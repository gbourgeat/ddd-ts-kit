import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { {{context.camel}}Permissions } from '{{alias.context}}/application/authorization/{{context.kebab}}.permissions{{alias.ext}}';

/** Provisions the account of the person who signs in, from what their token says of them, or refreshes it at a later sign-in. */
@Requires({{context.camel}}Permissions['account.provision'], { resource: () => ({ type: 'context', id: '{{context.kebab}}' }) })
export class ProvisionAccountCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly profile: { readonly email: string; readonly displayName: string },
  ) {
    super(actor);
  }
}
