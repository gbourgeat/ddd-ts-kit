import { ValueObject } from '@ddd-ts-kit/kernel';
import { InvalidEmail } from '@/contexts/identity/domain/errors/invalid-email.error';

export type EmailProps = {
  readonly value: string;
};

const ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LONGEST_ADDRESS = 254;

export class Email extends ValueObject<EmailProps> {
  private constructor(props: EmailProps) {
    super(props);
  }

  static create(value: string): Email {
    const normalized = value.trim().toLowerCase();

    if (normalized.length > LONGEST_ADDRESS || !ADDRESS.test(normalized)) {
      throw InvalidEmail.forAddress(value);
    }

    return new Email({ value: normalized });
  }

  get value(): string {
    return this.props.value;
  }
}
