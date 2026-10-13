import { AuthorizedCommand } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { {{context.camel}}Permissions } from '{{alias.context}}/application/authorization/{{context.kebab}}.permissions{{alias.ext}}';

/** Deactivates the account of the person who asks. */
@Requires({{context.camel}}Permissions['account.deactivate'], { resource: () => ({ type: 'context', id: '{{context.kebab}}' }) })
export class DeactivateAccountCommand extends AuthorizedCommand<string> {}
