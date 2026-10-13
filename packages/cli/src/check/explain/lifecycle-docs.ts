import type { RuleDoc } from '../model/rule-doc.js';

export const LIFECYCLE_DOCS: Readonly<Record<string, RuleDoc>> = {
  'lifecycle/status-through-machine': {
    why: 'A state machine says once which status follows which, and what refuses a forbidden transition with a static factory of the concept error. An aggregate that also writes its status by hand keeps a second, silent copy of its lifecycle: a transition the machine forbids happens anyway, and the diagram of CONTEXT.md, drawn from the machine, lies. So an aggregate whose machine exists (domain/state-machines/<aggregate>.state-machine.ts) imports it, and writes its status only from machine.next(..) or machine.start(..), or copies a status it read.',
    bad: `// domain/aggregates/appointment.aggregate.ts
confirm(now: Date): void {
  if (this.state.status !== 'requested') {
    throw AppointmentError.alreadyConfirmed(this.id);
  }

  this.state = { ...this.state, changedAt: now, status: 'booked' };
}`,
    good: `// domain/aggregates/appointment.aggregate.ts
confirm(now: Date): void {
  this.state = { ...this.state, changedAt: now, status: appointmentLifecycle.next(this.state.status, 'confirm') };
}`,
  },
  'process/sends-commands-only': {
    why: 'A process manager coordinates: it reacts to events, keeps its own state and decides what happens next. When it also loads and saves aggregates, of its context or another, or calls an outside system, it becomes a use case nobody can send, with no permission, no audit, and a transaction that spans what it should only coordinate. Its steps answer a decision whose commands do the work, each in its own handler; a file of application/processes/*.process.ts imports no aggregate, entity, repository, domain service, port or infrastructure.',
    bad: `// application/processes/appointment-reminder.process.ts
import { ReminderRepository } from '@/contexts/notification/domain/repositories/reminder.repository';

export class AppointmentReminderProcess {
  constructor(private readonly reminders: ReminderRepository) {}
}`,
    good: `// application/processes/appointment-reminder.process.ts
export class AppointmentReminderProcess implements ProcessManager<ReminderProcessState> {
  booked(event: AppointmentBookedV1, current: ReminderProcessState | undefined) {
    return { state: { appointmentId: event.payload.appointmentId, stage: 'waiting' }, commands: [new PlanReminderCommand(/* ... */)] };
  }
}`,
  },
};
