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
{{#if refusals.named}}
    // TODO(domain): take the facts known at birth as parameters, check each birth invariant and throw the refusal named after it when one is violated: `throw <Refusal>.for<Fact>(...)`, written with `ddd-ts-kit generate error {{context.kebab}} <Refusal> <factory>`.
{{/if}}
{{#if refusals.factories}}
    // TODO(domain): take the facts known at birth as parameters, check each birth invariant and throw the refusal of its error class when one is violated: `throw {{name.pascal}}Error.<refusal>(...)`, added with `ddd-ts-kit generate error {{context.kebab}} {{name.pascal}} <refusal>`.
{{/if}}
{{#if refusals.classes}}
    // TODO(domain): take the facts known at birth as parameters, check each birth invariant and throw a DomainError of ../errors when one is violated.
{{/if}}
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
