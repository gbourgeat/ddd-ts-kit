/** An erasure asked for an id that names no person of any network: a typo, refused before anything is touched. */
export class UnknownPatientError extends Error {
  constructor(readonly patientId: string) {
    super(`Patient ${patientId} is unknown to every network: nothing was erased`);
    this.name = 'UnknownPatientError';
  }
}
