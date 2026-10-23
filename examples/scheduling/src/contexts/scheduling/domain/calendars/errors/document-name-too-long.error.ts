import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { SchedulingCodes } from '@/contexts/scheduling/scheduling.codes';

export class DocumentNameTooLong extends DomainRefusal {
  readonly code = SchedulingCodes.DocumentNameTooLong;

  static withMaximum(longest: number) {
    return DocumentNameTooLong.refusal(`The name of a document holds at most ${longest} characters.`, {
      longest,
    }).exposing('longest');
  }
}
