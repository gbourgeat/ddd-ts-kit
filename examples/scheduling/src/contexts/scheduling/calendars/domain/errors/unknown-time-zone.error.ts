import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { SchedulingCodes } from '@/contexts/scheduling/scheduling.codes';

export class UnknownTimeZone extends DomainRefusal {
  readonly code = SchedulingCodes.UnknownTimeZone;

  static forName(name: string) {
    return UnknownTimeZone.refusal(`${name} is not a known time zone.`, { name });
  }
}
