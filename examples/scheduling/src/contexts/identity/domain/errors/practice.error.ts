import { ConceptError } from '@ddd-ts-kit/kernel';

export class PracticeError extends ConceptError {
  static alreadyMember(personId: string) {
    return PracticeError.refusal('ALREADY_MEMBER', `The person ${personId} is already a member of this practice.`, {
      personId,
    });
  }

  static notAMember(personId: string) {
    return PracticeError.refusal('NOT_A_MEMBER', `The person ${personId} is not a member of this practice.`, {
      personId,
    });
  }

  static notAPractitioner(personId: string) {
    return PracticeError.refusal(
      'NOT_A_PRACTITIONER',
      `The person ${personId} is not a practitioner of this practice.`,
      { personId },
    );
  }

  static notAnAssistant(personId: string) {
    return PracticeError.refusal('NOT_AN_ASSISTANT', `The person ${personId} is not an assistant of this practice.`, {
      personId,
    });
  }

  static lastManager() {
    return PracticeError.refusal(
      'LAST_MANAGER',
      'A practice keeps at least one manager: its last manager cannot be removed.',
    );
  }

  static notFound(practiceId: string) {
    return PracticeError.refusal('PRACTICE_NOT_FOUND', `The practice ${practiceId} does not exist.`, { practiceId });
  }

  static unknownRole(value: string) {
    return PracticeError.refusal(
      'UNKNOWN_ROLE',
      `"${value}" is not a role of a practice: manager, practitioner or assistant.`,
      { value },
    );
  }

  static unknownTimeZone(value: string) {
    return PracticeError.refusal('UNKNOWN_TIME_ZONE', `"${value}" is not an IANA time zone.`, { value });
  }
}
