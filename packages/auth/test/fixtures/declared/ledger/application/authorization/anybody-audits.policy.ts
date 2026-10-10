import { Policy } from '@ddd-ts-kit/kernel/declarations';

/** A permission that `definePermissions` did not make. */
@Policy({ id: 'ledger:entry.audit' }, { name: 'ledger.anybody-audits' })
export class AnybodyAudits {
  allows(): boolean {
    return true;
  }
}
