import { DomainError } from '@ddd-ts-kit/kernel';

export class PatientLimitReachedError extends DomainError {
  readonly code = 'PATIENT_LIMIT_REACHED';

  constructor(limit: number) {
    super(`The patient already holds ${limit} future appointments with this practitioner.`);
  }
}
