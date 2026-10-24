/**
 * One place a bounded context keeps a copy of a data subject (a row of a person, a contact, the
 * notes of their appointments), and how it erases it in the network of the work: rows deleted,
 * or their personal columns pseudonymised. The platform runs each step once per network, since a
 * step writes tenant data and no elevation widens a write.
 */
export interface ErasureStep {
  /** Which copy the step reaches, as the report names it: `identity.persons`, `scheduling.patient`. */
  readonly name: string;

  /** Erases what the step holds of the subject in the network of the work, and answers how many rows it reached. Safe to run again. */
  erase(subject: string): Promise<number>;
}
