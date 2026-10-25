import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Requires } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
{{#if style.declared}}
import { {{context.camel}}Permissions } from '{{alias.context}}/{{context.kebab}}.permissions{{alias.ext}}';
{{/if}}
import type { MemberRight } from '{{alias.context}}/domain/vocabularies/member-right.vocabulary{{alias.ext}}';

/** Lends some of the rights of the actor in an organisation to another of its members, for a period. */
{{#if style.declared}}
@Requires({{context.camel}}Permissions['delegation.grant'], { resource: () => ({ type: 'context', id: '{{context.kebab}}' }) })
{{/if}}
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
