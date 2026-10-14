import { EventSourcedAggregate, type AggregateHistory, type Appliers, type DomainEvent } from '../../../src/index.js';

export class AccountOpened implements DomainEvent {
  static readonly eventName = 'bank.account.opened';

  readonly name = AccountOpened.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly holder: string,
  ) {}
}

export class MoneyDeposited implements DomainEvent {
  static readonly eventName = 'bank.account.deposited';

  readonly name = MoneyDeposited.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly cents: number,
  ) {}
}

export class MoneyWithdrawn implements DomainEvent {
  static readonly eventName = 'bank.account.withdrawn';

  readonly name = MoneyWithdrawn.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly cents: number,
  ) {}
}

export type AccountEvent = AccountOpened | MoneyDeposited | MoneyWithdrawn;

export interface AccountState {
  readonly holder: string;
  readonly balance: number;
  readonly movements: number;
}

export class Overdraft extends Error {}

export const AT = new Date('2026-03-01T10:00:00.000Z');

/** An event-sourced aggregate of the specs: its state changes in its apply methods only. */
export class Account extends EventSourcedAggregate<AccountEvent, AccountState> {
  private state: AccountState = { holder: '', balance: 0, movements: 0 };

  private constructor(id: string) {
    super(id);
  }

  static open(id: string, holder: string): Account {
    const account = new Account(id);

    account.record(new AccountOpened(id, AT, holder));

    return account;
  }

  static rehydrate(id: string, history: AggregateHistory<AccountEvent, AccountState>): Account {
    const account = new Account(id);

    return account.replay(history, (state) => account.restore(state));
  }

  deposit(cents: number): this {
    this.record(new MoneyDeposited(this.id, AT, cents));

    return this;
  }

  withdraw(cents: number): this {
    if (cents > this.state.balance) {
      throw new Overdraft(`${this.id} holds ${this.state.balance}`);
    }

    this.record(new MoneyWithdrawn(this.id, AT, cents));

    return this;
  }

  toState(): AccountState {
    return { ...this.state };
  }

  protected appliers(): Appliers<AccountEvent> {
    return {
      'bank.account.opened': (event) => this.applyOpened(event),
      'bank.account.deposited': (event) => this.applyDeposited(event),
      'bank.account.withdrawn': (event) => this.applyWithdrawn(event),
    };
  }

  private restore(state: AccountState): void {
    this.state = state;
  }

  private applyOpened(event: AccountOpened): void {
    this.state = { ...this.state, holder: event.holder };
  }

  private applyDeposited(event: MoneyDeposited): void {
    this.state = { ...this.state, balance: this.state.balance + event.cents, movements: this.state.movements + 1 };
  }

  private applyWithdrawn(event: MoneyWithdrawn): void {
    this.state = { ...this.state, balance: this.state.balance - event.cents, movements: this.state.movements + 1 };
  }
}
