import { InMemoryReadModelStore } from '@ddd-ts-kit/kernel';
import {
  practitionerCriteria,
  type PractitionerDirectory,
  type PractitionerEntry,
} from '#src/contexts/scheduling/application/ports/practitioner-directory.port.js';

export class FakePractitionerDirectory
  extends InMemoryReadModelStore<PractitionerEntry>
  implements PractitionerDirectory
{
  constructor() {
    super(practitionerCriteria);
  }
}
