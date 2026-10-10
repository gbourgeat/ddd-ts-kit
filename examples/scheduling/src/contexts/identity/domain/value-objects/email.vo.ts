import { ValueObject, err, ok, type Result } from '@ddd-ts-kit/kernel';
import { InvalidEmailError } from '@/contexts/identity/domain/errors/invalid-email.error.js';

export type EmailProps = {
  readonly value: string;
};

const ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LONGEST_ADDRESS = 254;

export class Email extends ValueObject<EmailProps> {
  private constructor(props: EmailProps) {
    super(props);
  }

  static create(value: string): Result<Email, InvalidEmailError> {
    const normalized = value.trim().toLowerCase();

    if (normalized.length > LONGEST_ADDRESS || !ADDRESS.test(normalized)) {
      return err(new InvalidEmailError(value));
    }

    return ok(new Email({ value: normalized }));
  }

  get value(): string {
    return this.props.value;
  }
}
