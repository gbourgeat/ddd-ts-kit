import { ReadModelStore, defineCriteria } from '@ddd-ts-kit/kernel';

/** A practitioner of a practice, under the key `<practiceId>.<practitionerId>`. */
export type PractitionerEntry = {
  readonly id: string;
  readonly practiceId: string;
  readonly practitionerId: string;
  readonly displayName: string;
  readonly timeZone: string;
};

export const practitionerCriteria = defineCriteria<PractitionerEntry>({
  fields: {
    id: { type: 'string' },
    practiceId: { type: 'string', filter: ['eq'] },
    practitionerId: { type: 'string', filter: ['eq'] },
    displayName: { type: 'string', sortable: true },
    timeZone: { type: 'string' },
  },
  defaultSort: [{ field: 'displayName', direction: 'asc' }],
  tieBreaker: 'id',
});

export abstract class PractitionerDirectory extends ReadModelStore<PractitionerEntry> {}
