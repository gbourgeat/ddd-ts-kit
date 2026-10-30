import type { PersonalPayload } from '../definition/personal-payload';

/**
 * An integration event that carries personal data, as the `personal` option of its definition
 * says it: what an erasure reads to find a person in the records of the outbox. `ddd-ts-kit docs`
 * writes the list of a generated project.
 */
export interface PersonalEvent {
  readonly type: string;
  readonly version: number;
  readonly personal: PersonalPayload;
}
