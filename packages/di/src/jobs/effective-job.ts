import type { JobPolicy } from '@ddd-ts-kit/kernel';
import type { JobRegistration } from '../wiring/job-registration.js';

/** A declared job with the settings of the application applied and the defaults filled in. */
export interface EffectiveJob extends JobRegistration {
  readonly policy: JobPolicy;
}
