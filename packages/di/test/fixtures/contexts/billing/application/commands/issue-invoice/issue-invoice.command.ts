import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { permissions } from '../../authorization/billing.permissions.js';

@Requires(permissions['invoice.issue'], {
  resource: (command: IssueInvoice) => ({ type: 'customer', id: command.customerId }),
  audited: ['customerId'],
})
export class IssueInvoice extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly customerId: string,
  ) {
    super(actor);
  }
}
