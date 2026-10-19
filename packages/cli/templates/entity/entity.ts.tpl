import { Entity } from '@ddd-ts-kit/kernel';

export interface {{name.pascal}}State {
  // TODO(domain): declare the attributes of {{name.pascal}} with value objects, not primitives.
}

export class {{name.pascal}} extends Entity<string> {
  private constructor(
    id: string,
    private state: {{name.pascal}}State,
  ) {
    super(id);
  }

  static create(id: string, state: {{name.pascal}}State): {{name.pascal}} {
{{#if refusals.named}}
    // TODO(domain): check the invariants {{name.pascal}} guards on its own and throw the refusal named after one when it is violated (`ddd-ts-kit generate error {{context.kebab}} <Refusal> <factory>`); invariants spanning several entities belong to the aggregate root.
{{/if}}
{{#if refusals.factories}}
    // TODO(domain): check the invariants {{name.pascal}} guards on its own and throw a refusal of the error class of its aggregate when one is violated (`ddd-ts-kit generate error {{context.kebab}} <Concept> <refusal>`); invariants spanning several entities belong to the aggregate root.
{{/if}}
{{#if refusals.classes}}
    // TODO(domain): check the invariants {{name.pascal}} guards on its own and throw a DomainError of ../errors when one is violated; invariants spanning several entities belong to the aggregate root.
{{/if}}
    return new {{name.pascal}}(id, state);
  }

  static rehydrate(id: string, state: {{name.pascal}}State): {{name.pascal}} {
    return new {{name.pascal}}(id, state);
  }

  // TODO(domain): add the methods the aggregate root calls to change this entity, named after the business intention.

  toState(): {{name.pascal}}State {
    return { ...this.state };
  }
}
