import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { {{context.camel}}Permissions } from '{{alias.context}}/{{context.kebab}}.permissions{{alias.ext}}';

/** Ends a delegation of an organisation before its period. */
@Requires({{context.camel}}Permissions['delegation.revoke'], { resource: () => ({ type: 'context', id: '{{context.kebab}}' }) })
export class RevokeDelegationCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly organisationId: string,
    readonly delegationId: string,
  ) {
    super(actor);
  }
}
