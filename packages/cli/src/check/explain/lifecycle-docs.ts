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
};
