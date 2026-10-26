import { isDeepStrictEqual } from 'node:util';
import { ConcurrencyError, type AggregateRoot, type Repository } from '@ddd-ts-kit/kernel';
import type { SnapshotCodec } from './snapshot-codec';

/**
 * How the fake keeps its own copy, so that mutating an aggregate after `save` (or a loaded
 * one before saving it) never changes what is stored. Either a `clone` function, or the
 * snapshot pair a real adapter's mapper already has; snapshots go through `structuredClone`.
 */
export type InMemoryRepositoryOptions<A> = ({ readonly clone: (aggregate: A) => A } | SnapshotCodec<A, unknown>) & {
  /**
   * For an aggregate whose adapter is state-stored and moves the version on every save, an unchanged one
   * included (a save used to order the changes of others): the fake does the same. Off by default, as an
   * event store appends nothing for no pending change.
   */
  readonly versionsEverySave?: boolean;
};

interface Entry<A> {
  /** A new copy of the stored aggregate at each call. */
  readonly load: () => A;
  readonly version: number;
}

/** What `keep` makes of an aggregate: a way back to a copy of it, and the plain data to compare it with later. */
interface Kept<A> {
  readonly load: () => A;
  readonly fingerprint: unknown;
}

/**
 * A working repository over a Map: the fake of any aggregate repository port. Use it as is or
 * extend it to add the finders of the port. It enforces optimistic concurrency on `version`
 * like a real adapter: a save of an aggregate that is as it was when it was loaded or last saved changes
 * nothing (no new version, no conflict), as an event store appends nothing for no pending event. It passes the same `repositoryContract`.
 */
export class InMemoryRepository<A extends AggregateRoot<Id>, Id extends string | number = string>
  implements Repository<A, Id>
{
  private readonly entries = new Map<Id, Entry<A>>();

  private readonly versionsEverySave: boolean;

  private readonly keep: (aggregate: A) => Kept<A>;

  /** What each handed out or saved instance looked like then: a save of one that still does, changes nothing. */
  private readonly seen = new WeakMap<A, unknown>();

  constructor(options: InMemoryRepositoryOptions<A>) {
    this.versionsEverySave = options.versionsEverySave === true;
    this.keep = 'clone' in options ? keptByCloning(options.clone) : keptAsSnapshot(options);
  }

  async findById(id: Id): Promise<A | undefined> {
    const entry = this.entries.get(id);

    return entry === undefined ? undefined : this.revive(entry);
  }

  async save(aggregate: A): Promise<void> {
    const kept = this.keep(aggregate);

    if (
      !this.versionsEverySave &&
      this.seen.has(aggregate) &&
      isDeepStrictEqual(this.seen.get(aggregate), kept.fingerprint)
    ) {
      return;
    }

    const current = this.entries.get(aggregate.id)?.version ?? 0;

    if (aggregate.version !== current) {
      throw new ConcurrencyError(aggregate.id);
    }

    const version = current + 1;

    this.entries.set(aggregate.id, { load: kept.load, version });
    aggregate.version = version;
    this.seen.set(aggregate, this.keep(aggregate).fingerprint);
  }

  /** Copies of every stored aggregate, in insertion order, for assertions and finders. */
  all(): A[] {
    return [...this.entries.values()].map((entry) => this.revive(entry));
  }

  count(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }

  /** For subclasses whose port has a removal method. */
  protected remove(id: Id): boolean {
    return this.entries.delete(id);
  }

  private revive(entry: Entry<A>): A {
    const aggregate = entry.load();

    aggregate.version = entry.version;
    this.seen.set(aggregate, this.keep(aggregate).fingerprint);

    return aggregate;
  }
}

function keptByCloning<A>(clone: (aggregate: A) => A): (aggregate: A) => Kept<A> {
  return (aggregate) => {
    const stored = clone(aggregate);

    return { load: () => clone(stored), fingerprint: stored };
  };
}

function keptAsSnapshot<A>(codec: SnapshotCodec<A, unknown>): (aggregate: A) => Kept<A> {
  return (aggregate) => {
    const stored = structuredClone(codec.toSnapshot(aggregate));

    return { load: () => codec.fromSnapshot(structuredClone(stored)), fingerprint: stored };
  };
}
