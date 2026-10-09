import { Adapter, token } from '@ddd-ts-kit/kernel/declarations';

export interface Journal {
  entries(): readonly string[];
}

export const JOURNAL = token<Journal>('accounting.Journal');

@Adapter(JOURNAL, { kind: 'external' })
export class EmptyJournal implements Journal {
  entries(): readonly string[] {
    return [];
  }
}
