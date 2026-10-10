import { err, ok } from '../../../../../../src/index.js';
import type { EventContract } from '../../../../../../src/declarations.js';

export interface PatientRegisteredPayload {
  readonly patientId: string;
}

/** The contract of another context, as this one reads it. */
export const PatientRegistered: EventContract<PatientRegisteredPayload> = {
  type: 'registry.patient.registered',
  version: 1,
  parse(event) {
    const { payload } = event;

    if (typeof payload !== 'object' || payload === null || !('patientId' in payload)) {
      return err({ reason: 'invalid-payload' });
    }

    return typeof payload.patientId === 'string' ? ok({ ...event, payload: { patientId: payload.patientId } }) : err({ reason: 'invalid-payload' });
  },
};
