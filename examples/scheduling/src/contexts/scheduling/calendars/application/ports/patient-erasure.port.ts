/**
 * The right to erasure, for what this context keeps of a person in clear: the notes the staff
 * wrote on their appointments, the reasons of their cancellations, the documents attached to those
 * appointments and the name copied into the practitioner directory. The appointments and the
 * attendance records stay as facts that name the person by an opaque id; the words sealed in the
 * attendance records are erased by the key of the person, not here. Called by the platform, in the
 * network of the work, after the key is destroyed.
 */
export abstract class PatientErasure {
  /** Erases every copy in the network of the work and answers how many rows it reached. Safe to run again: it then reaches none. */
  abstract erase(personId: string): Promise<number>;
}
