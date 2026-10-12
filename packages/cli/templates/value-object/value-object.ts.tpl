import { InvariantViolation, ValueObject, err, ok, type Result } from '@ddd-ts-kit/kernel';

export type {{name.pascal}}Props = {
  readonly value: string;
};

export class {{name.pascal}} extends ValueObject<{{name.pascal}}Props> {
  private constructor(props: {{name.pascal}}Props) {
    super(props);
  }

  static create(value: string): Result<{{name.pascal}}, InvariantViolation> {
{{#if refusals.factories}}
    // TODO(domain): replace `value: string` by the real components of {{name.pascal}}, normalize them and check every validity rule; return `err(...)` with a refusal of the concept this value describes, for example `<Concept>Error.invalid{{name.pascal}}(value)` (`ddd-ts-kit generate error {{context.kebab}} <Concept> invalid{{name.pascal}}`), instead of InvariantViolation.
{{/if}}
{{#if refusals.classes}}
    // TODO(domain): replace `value: string` by the real components of {{name.pascal}}, normalize them and check every validity rule; return `err(...)` with a dedicated error (`ddd-ts-kit generate domain-error {{context.kebab}} Invalid{{name.pascal}}`) instead of InvariantViolation.
{{/if}}
    if (value.trim().length === 0) {
      return err(new InvariantViolation('{{name.title}} must not be empty.'));
    }

    return ok(new {{name.pascal}}({ value }));
  }

  // TODO(domain): add the operations of {{name.pascal}} (add, isWithin, ...); each returns a new instance, never mutates.

  get value(): string {
    return this.props.value;
  }
}
