import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Requires } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
{{#if style.declared}}
import { {{context.camel}}Permissions } from '{{alias.context}}/{{context.kebab}}.permissions{{alias.ext}}';
{{/if}}

/** Removes a member from an organisation. */
{{#if style.declared}}
@Requires({{context.camel}}Permissions['member.remove'], { resource: () => ({ type: 'context', id: '{{context.kebab}}' }) })
{{/if}}
export class RemoveMemberCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly organisationId: string,
    readonly accountId: string,
  ) {
    super(actor);
  }
}
