import type { PersonalDataCopy } from '../personal-data/personal-data-copy';

/**
 * The right to erasure, for what one bounded context keeps of a person in clear. The port of a
 * context extends it and names the copy it reaches, as a repository port extends `Repository`:
 * `export abstract class PatientErasure extends PersonalDataErasure {}`; the adapter of the
 * persistence package implements it from the `personalFields` declarations of the context, and
 * the platform hands every such port to `eraseDataSubject`, which runs them in every tenant once
 * the key of the subject is destroyed.
 */
export abstract class PersonalDataErasure implements PersonalDataCopy {
  static {
    Object.defineProperty(this, 'tokenKey', { value: 'kernel.PersonalDataErasure' });
  }

  abstract readonly name: string;

  abstract erase(subject: string): Promise<number>;
}
