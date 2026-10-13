import { IsISO8601 } from 'class-validator';

/** Two instants a client sends, ISO 8601 with their zone: declared once, whole or picked by each body that needs them. */
export class TimeSpan {
  /** The instant it starts, ISO 8601 with its zone. */
  @IsISO8601({ strict: true })
  startsAt = '';

  /** The instant it ends, ISO 8601 with its zone. */
  @IsISO8601({ strict: true })
  endsAt = '';
}
