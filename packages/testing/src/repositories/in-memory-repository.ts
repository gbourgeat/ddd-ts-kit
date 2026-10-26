import { ConcurrencyError, type AggregateRoot, type Repository } from '@ddd-ts-kit/kernel';
import type { SnapshotCodec } from './snapshot-codec';

/**
 * How the fake keeps its own copy, so that mutating an aggregate after `save` (or a loaded
 * one before saving it) never changes what is stored. Either a `clone` function, or the
 * snapshot pair a real adapter's mapper already has; snapshots go through `structuredClone`.
 */
export type InMemoryRepositoryOptions<A> = { readonly clone: (aggregate: A) => A } | SnapshotCodec<A, unknown>;

interface Entry<A> {
  /** A new copy of the stored aggregate at each call. */
  readonly load: () => A;
  readonly version: number;
}

/**
 * A working repository over a Map: the fake of any aggregate repository port. Use it as is or
 * extend it to add the finders of the port. It enforces optimistic concurrency on `version`
 * like a real adapter, and passes the same `repositoryContract`.
 */
export class InMemoryRepository<A extends AggregateRoot<Id>, Id extends string | number = string>
  implements Repository<A, Id>
{
  private readonly entries = new Map<Id, Entry<A>>();

  private readonly keep: (aggregate: A) => () => A;

  constructor(options: InMemoryRepositoryOptions<A>) {
    this.keep = 'clone' in options ? keptByCloning(options.clone) : keptAsSnapshot(options);
  }

  async findById(id: Id): Promise<A | undefined> {
    const entry = this.entries.get(id);

    return entry === undefined ? undefined : this.revive(entry);
  }

  async save(aggregate: A): Promise<void> {
    const current = this.entries.get(aggregate.id)?.version ?? 0;

    if (aggregate.version !== current) {
      throw new ConcurrencyError(aggregate.id);
    }

    const version = current + 1;

    this.entries.set(aggregate.id, { load: this.keep(aggregate), version });
    aggregate.version = version;
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

    return aggregate;
  }
}

function keptByCloning<A>(clone: (aggregate: A) => A): (aggregate: A) => () => A {
  return (aggregate) => {
    const stored = clone(aggregate);

    return () => clone(stored);
  };
}

function keptAsSnapshot<A>(codec: SnapshotCodec<A, unknown>): (aggregate: A) => () => A {
  return (aggregate) => {
    const stored = structuredClone(codec.toSnapshot(aggregate));

    return () => codec.fromSnapshot(structuredClone(stored));
  };
}
