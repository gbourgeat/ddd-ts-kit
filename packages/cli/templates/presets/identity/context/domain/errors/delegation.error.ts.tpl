import { ConceptError } from '@ddd-ts-kit/kernel';

/** What the delegations refuse: a member lends some of their rights to another, for a bounded time. */
export class DelegationError extends ConceptError {
  static notFound(delegationId: string) {
    return DelegationError.refusal('DELEGATION_NOT_FOUND', `No delegation ${delegationId}.`, {
      delegationId,
    }).exposing('delegationId');
  }

  static notActive(delegationId: string) {
    return DelegationError.refusal('DELEGATION_NOT_ACTIVE', `The delegation ${delegationId} already ended.`, {
      delegationId,
    });
  }

  static toOneself(accountId: string) {
    return DelegationError.refusal('DELEGATION_TO_ONESELF', 'A member delegates to another member.', { accountId });
  }

  static withoutRights() {
    return DelegationError.refusal('DELEGATION_WITHOUT_RIGHTS', 'A delegation lends at least one right.');
  }

  static beyondRights(right: string) {
    return DelegationError.refusal('DELEGATION_BEYOND_RIGHTS', `A member lends only the rights they hold: ${right}.`, {
      right,
    }).exposing('right');
  }

  static periodInverted(startsAt: Date, endsAt: Date) {
    return DelegationError.refusal('DELEGATION_PERIOD_INVERTED', 'A delegation ends after it starts.', {
      startsAt,
      endsAt,
    }).exposing('startsAt', 'endsAt');
  }

  static tooLong(longestDays: number) {
    return DelegationError.refusal(
      'DELEGATION_TOO_LONG',
      `A delegation lasts ${longestDays} days at most: a longer one is a role.`,
      { longestDays },
    ).exposing('longestDays');
  }
}
