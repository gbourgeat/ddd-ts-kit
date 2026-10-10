import { IsISO8601 } from 'class-validator';

export class AddTimeOffBody {
  @IsISO8601({ strict: true })
  startsAt = '';

  @IsISO8601({ strict: true })
  endsAt = '';
}
