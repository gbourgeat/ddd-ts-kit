import { InMemoryReadModelStore } from '@ddd-ts-kit/kernel';
import {
  practitionerCriteria,
  type PractitionerDirectory,
  type PractitionerEntry,
} from '@/contexts/scheduling/application/calendars/ports/practitioner-directory.port';

export class FakePractitionerDirectory
  extends InMemoryReadModelStore<PractitionerEntry>
  implements PractitionerDirectory
{
  constructor() {
    super(practitionerCriteria);
  }
}
