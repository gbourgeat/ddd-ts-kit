import { ValueObject, err, ok, type Result } from '@ddd-ts-kit/kernel';
import { PersonError } from '@/contexts/identity/domain/errors/person.error';

export type EmailProps = {
  readonly value: string;
};

const ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LONGEST_ADDRESS = 254;

export class Email extends ValueObject<EmailProps> {
  private constructor(props: EmailProps) {
    super(props);
  }

  static create(value: string): Result<Email, PersonError> {
    const normalized = value.trim().toLowerCase();

    if (normalized.length > LONGEST_ADDRESS || !ADDRESS.test(normalized)) {
      return err(PersonError.invalidEmail(value));
    }

    return ok(new Email({ value: normalized }));
  }

  get value(): string {
    return this.props.value;
  }
}
