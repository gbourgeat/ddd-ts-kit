import type { Actor } from '../../../../../../../src';
import { Policy } from '../../../../../../../src/declarations';
import type { Visit } from '../../domain/visit';
import { scheduleVisits } from './clinic.permissions';

@Policy(scheduleVisits, { name: 'clinic.only-own-patients' })
export class OnlyOwnPatients {
  allows(actor: Actor, visit: Visit): boolean {
    return visit.patientId === actor.id;
  }
}
