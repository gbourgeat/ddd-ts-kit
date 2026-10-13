import type { Injection } from '../injection.js';
import { PATHS } from '../paths.js';

const { SCHEDULING } = PATHS;
const APPOINTMENT = `${SCHEDULING}/domain/aggregates/appointment.aggregate.ts`;
const PROCESS = `${SCHEDULING}/application/processes/confirmation-deadline.process.ts`;

/** The lifecycles: a status that changes only through its state machine, a process that only decides commands. */
export const LIFECYCLE_INJECTIONS: readonly Injection[] = [
  {
    rule: 'lifecycle/status-through-machine',
    what: 'an appointment that writes its status by hand next to its state machine',
    file: APPOINTMENT,
    changes: [
      {
        file: APPOINTMENT,
        from: "      status: appointmentLifecycle.next(this.state.status, 'cancel', this.moment(now)),",
        to: '      status: AppointmentStatus.Cancelled,',
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/lifecycle-status-through-machine',
  },
  {
    rule: 'process/sends-commands-only',
    what: 'a process manager given the repository of the appointments, to write them itself',
    file: PROCESS,
    changes: [
      {
        file: PROCESS,
        where: 'start',
        to: "import type { AppointmentRepository } from '@/contexts/scheduling/domain/repositories/appointment.repository';\n",
      },
      {
        file: PROCESS,
        from: "  static readonly processName = 'scheduling.confirmation-deadline';\n",
        to: "  static readonly processName = 'scheduling.confirmation-deadline';\n\n  readonly appointments: readonly AppointmentRepository[] = [];\n",
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/process-sends-commands-only',
  },
];
