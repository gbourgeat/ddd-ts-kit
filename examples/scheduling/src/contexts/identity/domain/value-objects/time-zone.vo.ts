import { ValueObject, err, ok, type Result } from '@ddd-ts-kit/kernel';
import { UnknownTimeZoneError } from '#src/contexts/identity/domain/errors/unknown-time-zone.error.js';

export type TimeZoneProps = {
  readonly value: string;
};

export class TimeZone extends ValueObject<TimeZoneProps> {
  private constructor(props: TimeZoneProps) {
    super(props);
  }

  static create(value: string): Result<TimeZone, UnknownTimeZoneError> {
    const canonical = canonicalZoneOf(value.trim());

    if (canonical === undefined) {
      return err(new UnknownTimeZoneError(value));
    }

    return ok(new TimeZone({ value: canonical }));
  }

  get value(): string {
    return this.props.value;
  }
}

/** The IANA name as the zone database writes it, or nothing when the zone is not one of its areas. */
function canonicalZoneOf(value: string): string | undefined {
  if (!value.includes('/')) {
    return undefined;
  }

  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}
