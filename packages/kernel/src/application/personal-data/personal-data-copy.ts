/**
 * One place a bounded context keeps a copy of a data subject (the row of a person, a contact,
 * the notes of their appointments), and how it erases it in the tenant of the work: rows deleted,
 * or their personal columns pseudonymised. The platform runs each copy once per tenant, since a
 * copy writes tenant data and no elevation widens a write.
 */
export interface PersonalDataCopy {
  /** Which copy it reaches, as the report names it: `identity.persons`, `scheduling.patient`. */
  readonly name: string;

  /** Erases what it holds of the subject in the tenant of the work, and answers how many rows it reached. Safe to run again: it then reaches none. */
  erase(subject: string): Promise<number>;
}
