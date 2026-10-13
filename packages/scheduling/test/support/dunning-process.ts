import { Command, type ProcessDecision, type ProcessManager } from '@ddd-ts-kit/kernel';

export interface DunningState {
  readonly invoiceId: string;
  readonly stage: 'waiting' | 'reminded' | 'paid';
}

export class SendPaymentReminder extends Command {
  constructor(readonly invoiceId: string) {
    super();
  }
}

export class CloseDunning extends Command {
  constructor(readonly invoiceId: string) {
    super();
  }
}

/** The process of the specs: an issued invoice is reminded once when it falls due, unless it was paid first. */
export class DunningProcess implements ProcessManager<DunningState> {
  static readonly processName = 'billing.dunning';

  static readonly timeoutJob: string | undefined = 'billing.dunning-timeout';

  static isState(value: unknown): value is DunningState {
    return typeof value === 'object' && value !== null && 'invoiceId' in value && 'stage' in value;
  }

  issued(invoiceId: string, dueAt: Date, current: DunningState | undefined): ProcessDecision<DunningState> | undefined {
    if (current !== undefined) {
      return undefined;
    }

    return { state: { invoiceId, stage: 'waiting' }, timeouts: [{ name: 'reminder', at: dueAt }] };
  }

  postponed(dueAt: Date, current: DunningState | undefined): ProcessDecision<DunningState> | undefined {
    return current === undefined ? undefined : { state: current, timeouts: [{ name: 'reminder', at: dueAt }] };
  }

  paid(current: DunningState | undefined): ProcessDecision<DunningState> | undefined {
    if (current === undefined) {
      return undefined;
    }

    const { invoiceId } = current;

    return {
      state: { invoiceId, stage: 'paid' },
      cancel: ['reminder'],
      ended: true,
      commands: [new CloseDunning(invoiceId)],
    };
  }

  timedOut(name: string, current: DunningState): ProcessDecision<DunningState> | undefined {
    if (name !== 'reminder') {
      return undefined;
    }

    return { state: { ...current, stage: 'reminded' }, commands: [new SendPaymentReminder(current.invoiceId)] };
  }
}
