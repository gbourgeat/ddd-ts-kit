import { AuthorizedCommand, type Actor } from '../../../../../../../../src/index.js';
import { Requires } from '../../../../../../../../src/declarations.js';
import { scheduleVisits } from '../../authorization/clinic.permissions.js';

@Requires(scheduleVisits, {
  resource: (command: ScheduleVisit) => ({ type: 'patient', id: command.patientId }),
  context: (command: ScheduleVisit) => ({ onBehalfOf: command.actor.id }),
  audited: ['startsAt', { field: 'patientId', masked: true }],
})
export class ScheduleVisit extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly patientId: string,
    readonly startsAt: Date,
  ) {
    super(actor);
  }
}
