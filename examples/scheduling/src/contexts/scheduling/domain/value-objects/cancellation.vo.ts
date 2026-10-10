import { ValueObject, err, ok, type Result } from '@ddd-ts-kit/kernel';
import { ReasonRequiredError } from '../errors/reason-required.error.js';

export type CancellationProps = {
  readonly by: 'patient' | 'practice';
  readonly reason: string | undefined;
};

export class Cancellation extends ValueObject<CancellationProps> {
  private constructor(props: CancellationProps) {
    super(props);
  }

  /** A patient may cancel without a word; the practice says why. */
  static create(by: 'patient' | 'practice', reason?: string): Result<Cancellation, ReasonRequiredError> {
    const given = reason?.trim() ?? '';

    if (by === 'practice' && given.length === 0) {
      return err(new ReasonRequiredError());
    }

    return ok(new Cancellation({ by, reason: given.length === 0 ? undefined : given }));
  }

  get by(): 'patient' | 'practice' {
    return this.props.by;
  }

  get reason(): string | undefined {
    return this.props.reason;
  }
}
