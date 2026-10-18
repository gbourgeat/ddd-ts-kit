import { ValueObject } from '@ddd-ts-kit/kernel';
import { InvalidDisplayName } from '@/contexts/identity/domain/errors/invalid-display-name.error';

export type DisplayNameProps = {
  readonly value: string;
};

const LONGEST_NAME = 120;

export class DisplayName extends ValueObject<DisplayNameProps> {
  private constructor(props: DisplayNameProps) {
    super(props);
  }

  static create(value: string): DisplayName {
    const normalized = value.trim().replace(/\s+/g, ' ');

    if (normalized.length === 0 || normalized.length > LONGEST_NAME) {
      throw InvalidDisplayName.becauseOfLength();
    }

    return new DisplayName({ value: normalized });
  }

  get value(): string {
    return this.props.value;
  }
}
