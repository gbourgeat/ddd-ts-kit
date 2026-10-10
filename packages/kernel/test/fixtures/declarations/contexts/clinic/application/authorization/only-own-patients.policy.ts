import type { Actor } from '../../../../../../../src/index.js';
import { Policy } from '../../../../../../../src/declarations.js';
import type { Visit } from '../../domain/visit.js';
import { scheduleVisits } from './clinic.permissions.js';

@Policy(scheduleVisits, { name: 'clinic.only-own-patients' })
export class OnlyOwnPatients {
  allows(actor: Actor, visit: Visit): boolean {
    return visit.patientId === actor.id;
  }
}
