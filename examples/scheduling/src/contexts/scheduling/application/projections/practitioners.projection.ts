import { stampOf, type ReadModelWrite } from '@ddd-ts-kit/kernel';
import { On, Projection } from '@ddd-ts-kit/kernel/declarations';
import {
  practiceMemberAddedV1,
  practiceMemberRemovedV1,
  type PracticeMemberAddedV1,
  type PracticeMemberRemovedV1,
} from '../../../identity/published-language/index.js';
import { storableStamp } from '../../../../shared-kernel/storable-stamp.js';
import { PractitionerDirectory } from '../ports/practitioner-directory.port.js';

/** Keeps the practitioners of each practice, with the time zone of the practice, from what identity announces of its members. */
@Projection('scheduling.practitioners', [PractitionerDirectory])
export class PractitionersProjection {
  constructor(private readonly practitioners: PractitionerDirectory) {}

  @On(practiceMemberAddedV1)
  async added(event: PracticeMemberAddedV1): Promise<ReadModelWrite> {
    const { practiceId, personId, role, displayName, timeZone } = event.payload;

    if (role !== 'practitioner') {
      return 'ignored';
    }

    const id = `${practiceId}.${personId}`;

    return this.practitioners.upsertIfNewer(id, storableStamp(stampOf(event)), () => ({
      id,
      practiceId,
      practitionerId: personId,
      displayName,
      timeZone,
    }));
  }

  @On(practiceMemberRemovedV1)
  async removed(event: PracticeMemberRemovedV1): Promise<ReadModelWrite> {
    const { practiceId, personId, role } = event.payload;

    if (role !== 'practitioner') {
      return 'ignored';
    }

    return this.practitioners.delete(`${practiceId}.${personId}`, storableStamp(stampOf(event)));
  }
}
