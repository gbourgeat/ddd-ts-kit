/**
 * The words a refusal class may use beside the terms of its glossary: they say how a concept is
 * refused (`InvalidAppointment`, `BookingTooLate`, `SlotAlreadyTaken`, `NoOpenSlot`), not what it
 * is, so no glossary defines them. Read by `language/glossary-term`, `generate error` and
 * `error-factories`.
 */
export const REFUSAL_QUALIFIERS: readonly string[] = [
  'invalid',
  'unknown',
  'already',
  'too',
  'no',
  'missing',
  'required',
];
