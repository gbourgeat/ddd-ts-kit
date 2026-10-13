import { ValueObject } from '@ddd-ts-kit/kernel';
import { AccountError } from '{{alias.context}}/domain/errors/account.error{{alias.ext}}';

/** The longest address the standards allow (RFC 5321, a path of 256 characters and its two brackets). */
const LONGEST = 254;
const SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EmailAddressProps = {
  readonly value: string;
};

/** Where a person is reached, compared without case: `Ada@Example.org` and `ada@example.org` are one address. */
export class EmailAddress extends ValueObject<EmailAddressProps> {
  private constructor(props: EmailAddressProps) {
    super(props);
  }

  static create(raw: string): EmailAddress {
    const value = raw.trim().toLowerCase();

    if (value.length > LONGEST || !SHAPE.test(value)) {
      throw AccountError.invalidEmailAddress(raw);
    }

    return new EmailAddress({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
