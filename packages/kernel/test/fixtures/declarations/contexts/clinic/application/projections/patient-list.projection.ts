import { stampOf, type IntegrationEvent, type ReadModelWrite } from '../../../../../../../src';
import { On, Projection } from '../../../../../../../src/declarations';
import { VisitScheduled } from '../../domain/events/visit-scheduled.event';
import { PatientRegistered, type PatientRegisteredPayload } from '../../published-language/patient-registered';
import { PatientList } from '../ports/patient-list.port';

@Projection('clinic.patient-list', [PatientList])
export class PatientListProjection {
  static built = 0;

  constructor(private readonly patients: PatientList) {
    PatientListProjection.built += 1;
  }

  @On(PatientRegistered)
  async registered(event: IntegrationEvent<PatientRegisteredPayload>): Promise<ReadModelWrite> {
    return this.patients.upsertIfNewer(event.payload.patientId, stampOf(event), () => ({
      id: event.payload.patientId,
      visits: 0,
    }));
  }

  @On(VisitScheduled)
  async visitScheduled(event: VisitScheduled): Promise<ReadModelWrite> {
    return this.patients.upsertIfNewer(event.aggregateId, stampOf(event), (patient) =>
      patient === undefined ? undefined : { ...patient, visits: patient.visits + 1 },
    );
  }
}
