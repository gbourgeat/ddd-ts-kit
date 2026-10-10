import { ReadModelStore, defineCriteria } from '@ddd-ts-kit/kernel';

/** The address at which a recipient is reached, as identity last announced it. */
export type Contact = {
  readonly recipientId: string;
  readonly address: string;
};

export const contactCriteria = defineCriteria<Contact>({
  fields: {
    recipientId: { type: 'string', filter: ['eq'] },
    address: { type: 'string' },
  },
  defaultSort: [{ field: 'recipientId', direction: 'asc' }],
  tieBreaker: 'recipientId',
});

export abstract class Contacts extends ReadModelStore<Contact> {}
