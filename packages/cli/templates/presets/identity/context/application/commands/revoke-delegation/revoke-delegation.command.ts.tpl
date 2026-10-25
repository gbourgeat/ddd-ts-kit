import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Requires } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
{{#if style.declared}}
import { {{context.camel}}Permissions } from '{{alias.context}}/{{context.kebab}}.permissions{{alias.ext}}';
{{/if}}

/** Ends a delegation of an organisation before its period. */
{{#if style.declared}}
@Requires({{context.camel}}Permissions['delegation.revoke'], { resource: () => ({ type: 'context', id: '{{context.kebab}}' }) })
{{/if}}
export class RevokeDelegationCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly organisationId: string,
    readonly delegationId: string,
  ) {
    super(actor);
  }
}
