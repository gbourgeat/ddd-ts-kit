import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Requires } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
{{#if style.declared}}
import { {{context.camel}}Permissions } from '{{alias.context}}/{{context.kebab}}.permissions{{alias.ext}}';
{{/if}}

/** Provisions the account of the person who signs in, from what their token says of them, or refreshes it at a later sign-in. */
{{#if style.declared}}
@Requires({{context.camel}}Permissions['account.provision'], { resource: () => ({ type: 'context', id: '{{context.kebab}}' }) })
{{/if}}
export class ProvisionAccountCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly profile: { readonly email: string; readonly emailVerified: boolean; readonly displayName: string },
  ) {
    super(actor);
  }
}
