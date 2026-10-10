import type { Actor } from '@ddd-ts-kit/kernel';
import { Policy } from '@ddd-ts-kit/kernel/declarations';
import type { Entry } from '../../domain/entry.js';
import { ledgerPermissions } from './ledger.permissions.js';

@Policy(ledgerPermissions['entry.reverse'], { name: 'ledger.only-poster-reverses' })
export class OnlyPosterReverses {
  static built = 0;

  constructor() {
    OnlyPosterReverses.built += 1;
  }

  appliesTo(subject: unknown): boolean {
    return typeof subject === 'object' && subject !== null && 'postedBy' in subject;
  }

  allows(actor: Actor, entry: Entry): boolean {
    return entry.postedBy === actor.id;
  }
}
