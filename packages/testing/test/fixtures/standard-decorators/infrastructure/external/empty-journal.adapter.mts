import { Adapter } from '@ddd-ts-kit/kernel/declarations';
import { Journal } from '../../application/ports/journal.port';

@Adapter(Journal, { kind: 'external' })
export class EmptyJournal implements Journal {
  entries(): readonly string[] {
    return [];
  }
}
