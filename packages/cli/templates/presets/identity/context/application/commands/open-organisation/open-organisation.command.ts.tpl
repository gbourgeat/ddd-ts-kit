import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Requires } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
{{#if style.declared}}
import { {{context.camel}}Permissions } from '{{alias.context}}/{{context.kebab}}.permissions{{alias.ext}}';
{{/if}}

/** Opens an organisation; the account that opens it is its first owner. */
{{#if style.declared}}
@Requires({{context.camel}}Permissions['organisation.open'], { resource: () => ({ type: 'context', id: '{{context.kebab}}' }) })
{{/if}}
export class OpenOrganisationCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly organisation: { readonly slug: string; readonly name: string },
  ) {
    super(actor);
  }
}
