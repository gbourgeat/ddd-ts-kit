import { EventSourcedAggregate, type AggregateHistory, type Appliers } from '@ddd-ts-kit/kernel';
import { {{event.pascal}} } from '{{alias.context}}/domain/events/{{event.kebab}}.event{{alias.ext}}';

export type {{name.pascal}}Event = {{event.pascal}};

export interface {{name.pascal}}State {
  readonly registeredAt: Date;
  // TODO(domain): declare the rest of the state of {{name.pascal}} with value objects (a Money, a Period), not primitives: what its commands need to decide, nothing more.
}

export class {{name.pascal}} extends EventSourcedAggregate<{{name.pascal}}Event, {{name.pascal}}State> {
  private state: {{name.pascal}}State = { registeredAt: new Date(0) };

  private constructor(id: string) {
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
    const created = new {{name.pascal}}(id);

    created.record(new {{event.pascal}}(id, now));

    return created;
  }

  static rehydrate(id: string, history: AggregateHistory<{{name.pascal}}Event, {{name.pascal}}State>): {{name.pascal}} {
    const loaded = new {{name.pascal}}(id);

    return loaded.replay(history, (state) => loaded.restore(state));
  }

  // TODO(domain): add one method per business intention: it checks its invariants on `this.state`, then records what it decided, `this.record(new {{name.pascal}}<Fact>(this.id, now, ...))`, after `ddd-ts-kit generate domain-event {{context.kebab}} {{name.pascal}} <Fact>` added the event and its apply method. It never writes the state itself (event-sourcing/state-in-apply).

  get registeredAt(): Date {
    return this.state.registeredAt;
  }

  toState(): {{name.pascal}}State {
    return { ...this.state };
  }

  protected appliers(): Appliers<{{name.pascal}}Event> {
    return {
      [{{event.pascal}}.eventName]: (event) => this.apply{{event.fact}}(event),
    };
  }

  private restore(state: {{name.pascal}}State): void {
    this.state = state;
  }

  private apply{{event.fact}}(event: {{event.pascal}}): void {
    this.state = { ...this.state, registeredAt: event.occurredAt };
  }
}
