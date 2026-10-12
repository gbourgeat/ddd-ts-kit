import { ConceptError } from '@ddd-ts-kit/kernel';

export class DelegationError extends ConceptError {
  static alreadyActive(delegationId: string) {
    return DelegationError.refusal(
      'DELEGATION_ALREADY_ACTIVE',
      `This practitioner already delegates to this assistant (delegation ${delegationId}).`,
      { delegationId },
    );
  }

  static endsInThePast(endsAt: Date) {
    return DelegationError.refusal(
      'DELEGATION_ENDS_IN_THE_PAST',
      `A delegation cannot end in the past (${endsAt.toISOString()}).`,
      { endsAt },
    ).exposing('endsAt');
  }

  static notActive(delegationId: string) {
    return DelegationError.refusal('DELEGATION_NOT_ACTIVE', `The delegation ${delegationId} already ended.`, {
      delegationId,
    });
  }

  static notFound(delegationId: string) {
    return DelegationError.refusal(
      'DELEGATION_NOT_FOUND',
      `The delegation ${delegationId} does not exist on this desk.`,
      { delegationId },
    );
  }
}
