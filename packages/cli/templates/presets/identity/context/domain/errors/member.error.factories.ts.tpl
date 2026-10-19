import { ConceptError } from '@ddd-ts-kit/kernel';

/** What the members of an organisation refuse. */
export class MemberError extends ConceptError {
  static notFound(organisationId: string, accountId: string) {
    return MemberError.refusal('MEMBER_NOT_FOUND', `The account ${accountId} is not a member of ${organisationId}.`, {
      organisationId,
      accountId,
    }).exposing('organisationId', 'accountId');
  }

  static alreadyMember(organisationId: string, accountId: string) {
    return MemberError.refusal('ALREADY_MEMBER', `The account ${accountId} is already a member of ${organisationId}.`, {
      organisationId,
      accountId,
    }).exposing('organisationId', 'accountId');
  }

  static lastOwner(organisationId: string) {
    return MemberError.refusal('LAST_OWNER', `${organisationId} keeps at least one owner.`, {
      organisationId,
    }).exposing('organisationId');
  }

  static ownersOnly(organisationId: string) {
    return MemberError.refusal('OWNERS_ONLY', `Only an owner of ${organisationId} appoints or changes an owner.`, {
      organisationId,
    });
  }

  static ownRole(organisationId: string) {
    return MemberError.refusal(
      'OWN_ROLE',
      `A member of ${organisationId} does not change their own role: another member does.`,
      {
        organisationId,
      },
    );
  }

  static aboveOwnRole(organisationId: string) {
    return MemberError.refusal(
      'ABOVE_OWN_ROLE',
      `A member of ${organisationId} appoints, changes or removes no one above their own role.`,
      {
        organisationId,
      },
    );
  }
}
