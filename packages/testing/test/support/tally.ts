import { EventSourcedAggregate, type AggregateHistory, type Appliers, type DomainEvent } from '@ddd-ts-kit/kernel';

export class TallyCounted implements DomainEvent {
  readonly name = 'votes.tally.counted';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly votes: number,
  ) {}
}

export class TallyClosed implements DomainEvent {
  readonly name = 'votes.tally.closed';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
  ) {}
}

type TallyEvent = TallyCounted | TallyClosed;

export interface TallyState {
  readonly votes: number;
  readonly closed: boolean;
}

export class TallyClosedError extends Error {}

const AT = new Date('2026-03-01T10:00:00.000Z');

export class Tally extends EventSourcedAggregate<TallyEvent, TallyState> {
  private state: TallyState = { votes: 0, closed: false };

  private constructor(id: string) {
    super(id);
  }

  static rehydrate(id: string, history: AggregateHistory<TallyEvent, TallyState>): Tally {
    const tally = new Tally(id);

    return tally.replay(history, (state) => tally.restore(state));
  }

  count(votes: number): void {
    if (this.state.closed) {
      throw new TallyClosedError(this.id);
    }

    this.record(new TallyCounted(this.id, AT, votes));
  }

  close(): void {
    this.record(new TallyClosed(this.id, AT));
  }

  toState(): TallyState {
    return this.state;
  }

  protected appliers(): Appliers<TallyEvent> {
    return {
      'votes.tally.counted': (event) => this.applyCounted(event),
      'votes.tally.closed': () => this.applyClosed(),
    };
  }

  private restore(state: TallyState): void {
    this.state = state;
  }

  private applyCounted(event: TallyCounted): void {
    this.state = { ...this.state, votes: this.state.votes + event.votes };
  }

  private applyClosed(): void {
    this.state = { ...this.state, closed: true };
  }
}

export const counted = (votes: number): TallyCounted => new TallyCounted('t1', AT, votes);
export const closed = (): TallyClosed => new TallyClosed('t1', AT);
