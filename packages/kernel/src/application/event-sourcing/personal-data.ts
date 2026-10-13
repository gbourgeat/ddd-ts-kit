/** A personal value in the data `encode` answers, until the serializer seals it. */
export interface PersonalValue {
  readonly $personal: { readonly subject: string; readonly value: string };
}

/**
 * Marks a personal value of the data of a stored event, in `encode`: `note: personalData(patientId, note)`.
 * The serializer seals it with the key of its data subject before it reaches the store, and opens
 * it when the event is read; once the subject is erased, the read gives `ERASED_PERSONAL_DATA`.
 */
export function personalData(subject: string, value: string): PersonalValue {
  return { $personal: { subject, value } };
}
