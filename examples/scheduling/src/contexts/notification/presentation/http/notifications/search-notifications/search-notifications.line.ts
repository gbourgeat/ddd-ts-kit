import { IsISO8601, IsIn, IsString } from 'class-validator';

export class SearchNotificationsLine {
  @IsString()
  id = '';

  @IsIn(['request', 'confirmation', 'rescheduling', 'cancellation', 'reminder'])
  kind = '';

  @IsString()
  appointmentId = '';

  @IsISO8601()
  startsAt = '';

  @IsISO8601()
  sentAt = '';
}
