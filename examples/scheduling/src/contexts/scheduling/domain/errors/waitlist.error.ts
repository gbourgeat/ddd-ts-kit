import { ConceptError } from '@ddd-ts-kit/kernel';

export class WaitlistError extends ConceptError {
  static alreadyWaiting(patientId: string) {
    return WaitlistError.refusal('ALREADY_WAITING', `The patient ${patientId} is already on this waitlist.`, {
      patientId,
    });
  }

  static invalidOffer(rule: string) {
    return WaitlistError.refusal('INVALID_OFFER', `An offer ${rule}.`, { rule });
  }

  static invalidWaiter(rule: string) {
    return WaitlistError.refusal('INVALID_WAITER', `A waiter ${rule}.`, { rule });
  }
}
