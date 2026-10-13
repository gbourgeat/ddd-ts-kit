import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { {{context.camel}}Permissions } from '{{alias.context}}/application/authorization/{{context.kebab}}.permissions{{alias.ext}}';

/** Removes a member from an organisation. */
@Requires({{context.camel}}Permissions['member.remove'], { resource: () => ({ type: 'context', id: '{{context.kebab}}' }) })
export class RemoveMemberCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly organisationId: string,
    readonly accountId: string,
  ) {
    super(actor);
  }
}
