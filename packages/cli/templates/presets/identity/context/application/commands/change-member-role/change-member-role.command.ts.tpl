import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Requires } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
{{#if style.declared}}
import { {{context.camel}}Permissions } from '{{alias.context}}/{{context.kebab}}.permissions{{alias.ext}}';
{{/if}}
import type { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';

/** Changes the role of a member of an organisation. */
{{#if style.declared}}
@Requires({{context.camel}}Permissions['member.change-role'], { resource: () => ({ type: 'context', id: '{{context.kebab}}' }) })
{{/if}}
export class ChangeMemberRoleCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly organisationId: string,
    readonly accountId: string,
    readonly role: MemberRole,
  ) {
    super(actor);
  }
}
