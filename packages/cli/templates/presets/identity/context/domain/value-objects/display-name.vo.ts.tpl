import { ValueObject } from '@ddd-ts-kit/kernel';
{{#unless refusals.named}}
import { AccountError } from '{{alias.context}}/domain/errors/account.error{{alias.ext}}';
{{/unless}}
{{#if refusals.named}}
import { InvalidDisplayName } from '{{alias.context}}/domain/errors/invalid-display-name.error{{alias.ext}}';
{{/if}}

const LONGEST = 100;

export type DisplayNameProps = {
  readonly value: string;
};

/** How a person is shown to the others, as they or their identity provider wrote it, spaces at the ends removed. */
export class DisplayName extends ValueObject<DisplayNameProps> {
  private constructor(props: DisplayNameProps) {
    super(props);
  }

  static create(raw: string): DisplayName {
    const value = raw.trim();

    if (value.length === 0 || value.length > LONGEST) {
{{#if refusals.named}}
      throw InvalidDisplayName.forValue(raw);
{{/if}}
{{#unless refusals.named}}
      throw AccountError.invalidDisplayName(raw);
{{/unless}}
    }

    return new DisplayName({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
