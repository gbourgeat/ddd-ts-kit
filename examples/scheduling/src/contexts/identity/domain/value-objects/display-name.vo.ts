import { ValueObject, err, ok, type Result } from '@ddd-ts-kit/kernel';
import { InvalidDisplayNameError } from '../errors/invalid-display-name.error.js';

export type DisplayNameProps = {
  readonly value: string;
};

const LONGEST_NAME = 120;

export class DisplayName extends ValueObject<DisplayNameProps> {
  private constructor(props: DisplayNameProps) {
    super(props);
  }

  static create(value: string): Result<DisplayName, InvalidDisplayNameError> {
    const normalized = value.trim().replace(/\s+/g, ' ');

    if (normalized.length === 0 || normalized.length > LONGEST_NAME) {
      return err(new InvalidDisplayNameError());
    }

    return ok(new DisplayName({ value: normalized }));
  }

  get value(): string {
    return this.props.value;
  }
}
