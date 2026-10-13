export const OutcomeState = {
  Held: 'held',
  Completed: 'completed',
  NoShow: 'no-show',
  CancelledByPatient: 'cancelled-by-patient',
  CancelledByPractice: 'cancelled-by-practice',
  Expired: 'expired',
} as const;

export type OutcomeState = (typeof OutcomeState)[keyof typeof OutcomeState];
