import { AggregateRoot } from '@ddd-ts-kit/kernel';

export interface {{name.pascal}}State {
  readonly registeredAt: Date;
  // TODO(domain): declare the rest of the state of {{name.pascal}} with value objects (a Money, a Period), not primitives.
}

export class {{name.pascal}} extends AggregateRoot<string> {
  private constructor(
    id: string,
    private state: {{name.pascal}}State,
  ) {
    super(id);
  }

  static create(id: string, now: Date): {{name.pascal}} {
    // TODO(domain): take the facts known at birth as parameters, check each birth invariant and throw a DomainError of ../errors when one is violated.
    const created = new {{name.pascal}}(id, { registeredAt: now });
    // TODO(domain): record the birth fact with `created.record(new {{name.pascal}}Created(id, now))` after `ddd-ts-kit generate domain-event {{context.kebab}} {{name.pascal}} Created`.
    return created;
  }

  static rehydrate(id: string, state: {{name.pascal}}State): {{name.pascal}} {
    return new {{name.pascal}}(id, state);
  }

  // TODO(domain): add one method per business intention (issue, cancel, ...): each guards its invariants, replaces `this.state` and records the event of what happened.

  get registeredAt(): Date {
    return this.state.registeredAt;
  }

  toState(): {{name.pascal}}State {
    return { ...this.state };
  }
}
