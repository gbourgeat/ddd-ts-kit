import { ReadModelStore, defineCriteria } from '@ddd-ts-kit/kernel';

export interface BalanceRow {
  readonly accountId: string;
  readonly cents: number;
}

export const balanceCriteria = defineCriteria<BalanceRow>({
  fields: { accountId: { type: 'string', filter: ['eq'] }, cents: { type: 'number', sortable: true } },
  defaultSort: [{ field: 'cents', direction: 'desc' }],
  tieBreaker: 'accountId',
});

/** The balance of each account, kept from its stream. */
export abstract class Balances extends ReadModelStore<BalanceRow> {}
