import { AuthorizedCommand } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Requires } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
{{#if style.declared}}
import { {{context.camel}}Permissions } from '{{alias.context}}/{{context.kebab}}.permissions{{alias.ext}}';
{{/if}}

/** Deactivates the account of the person who asks. */
{{#if style.declared}}
@Requires({{context.camel}}Permissions['account.deactivate'], { resource: () => ({ type: 'context', id: '{{context.kebab}}' }) })
{{/if}}
export class DeactivateAccountCommand extends AuthorizedCommand<string> {}
