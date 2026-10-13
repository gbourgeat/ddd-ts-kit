import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { {{context.camel}}Permissions } from '{{alias.context}}/application/authorization/{{context.kebab}}.permissions{{alias.ext}}';
import type { MemberRight } from '{{alias.context}}/domain/vocabularies/member-right.vocabulary{{alias.ext}}';

/** Lends some of the rights of the actor in an organisation to another of its members, for a period. */
@Requires({{context.camel}}Permissions['delegation.grant'], { resource: () => ({ type: 'context', id: '{{context.kebab}}' }) })
export class GrantDelegationCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly organisationId: string,
    readonly terms: {
      readonly delegateId: string;
      readonly rights: readonly MemberRight[];
      readonly startsAt: Date;
      readonly endsAt: Date;
    },
  ) {
    super(actor);
  }
}
