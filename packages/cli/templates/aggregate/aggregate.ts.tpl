import { AggregateRoot } from '@ddd-ts-kit/kernel';
{{#if birth.named}}
import { {{birth.pascal}} } from '{{alias.context}}/domain/events/{{birth.kebab}}.event{{alias.ext}}';
{{/if}}

export interface {{name.pascal}}State {
  // TODO(domain): declare the state of {{name.pascal}} with value objects (a Money, a Period), not primitives. When it was created is in the audit columns of its row; an instant a rule reads is a field named after its fact.
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
    const created = new {{name.pascal}}(id, {});

{{#if birth.named}}
    created.record(new {{birth.pascal}}(id, now));

{{/if}}
{{#unless birth.named}}
    // TODO(domain): name the fact {{name.pascal}} is born with, recorded at `now`: `ddd-ts-kit generate aggregate {{context.kebab}} {{name.pascal}} --birth "<Fact>" --force` names the birth and writes its event.
{{/unless}}
    return created;
  }

  static rehydrate(id: string, state: {{name.pascal}}State): {{name.pascal}} {
    return new {{name.pascal}}(id, state);
  }

  // TODO(domain): add one method per business intention (issue, cancel, ...): each guards its invariants, replaces `this.state` and records the event of what happened.

  toState(): {{name.pascal}}State {
    return { ...this.state };
  }
}
