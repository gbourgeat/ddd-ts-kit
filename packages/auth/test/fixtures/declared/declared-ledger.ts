import { AuthorizedCommand, Query, type Actor } from '@ddd-ts-kit/kernel';
import { CommandHandler, Policy, Public, QueryHandler, Repository, Requires, token } from '@ddd-ts-kit/kernel/declarations';
import { ACCESS, definePermissions, type Access } from '../../../src/index.js';

/** A context in the declared style: what would be spread over its application and infrastructure folders. */

export const ledgerPermissions = definePermissions('ledger', {
  'entry.post': { description: 'Post an entry to the ledger' },
  'entry.reverse': { description: 'Reverse a posted entry' },
});

export interface Entry {
  readonly id: string;
  readonly account: string;
  readonly postedBy: string;
}

export const ENTRIES = token<Entries>('ledger.Entries');

@Repository(ENTRIES)
export class Entries {
  readonly posted = new Map<string, Entry>();
}

@Requires(ledgerPermissions['entry.post'], { resource: (command: PostEntry) => ({ type: 'account', id: command.account }) })
export class PostEntry extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly account: string,
  ) {
    super(actor);
  }
}

@CommandHandler(PostEntry, [ENTRIES])
export class PostEntryHandler implements CommandHandler<PostEntry> {
  constructor(private readonly entries: Entries) {}

  async execute(command: PostEntry): Promise<string> {
    const id = `entry-${this.entries.posted.size + 1}`;
    this.entries.posted.set(id, { id, account: command.account, postedBy: command.actor.id });
    return id;
  }
}

@Requires(ledgerPermissions['entry.reverse'])
export class ReverseEntry extends AuthorizedCommand {
  constructor(
    actor: Actor,
    readonly entryId: string,
  ) {
    super(actor);
  }
}

@CommandHandler(ReverseEntry, [ENTRIES, ACCESS])
export class ReverseEntryHandler implements CommandHandler<ReverseEntry> {
  constructor(
    private readonly entries: Entries,
    private readonly access: Access,
  ) {}

  async execute(command: ReverseEntry): Promise<void> {
    const entry = this.entries.posted.get(command.entryId);
    await this.access.authorize(command.actor, ledgerPermissions['entry.reverse'], entry);
    this.entries.posted.delete(command.entryId);
  }
}

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

@Public()
export class CountEntries extends Query<number> {}

@QueryHandler(CountEntries, [ENTRIES])
export class CountEntriesHandler implements QueryHandler<CountEntries> {
  constructor(private readonly entries: Entries) {}

  async execute(): Promise<number> {
    return this.entries.posted.size;
  }
}

/** A permission that `definePermissions` did not make. */
@Policy({ id: 'ledger:entry.audit' }, { name: 'ledger.anybody-audits' })
export class AnybodyAudits {
  allows(): boolean {
    return true;
  }
}
