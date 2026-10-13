import { IsISO8601, IsIn, IsString } from 'class-validator';
import { NotificationKindName } from '@/contexts/notification/domain/vocabularies/notification-kind-name.vocabulary';

export class SearchNotificationsLine {
  @IsString()
  id = '';

  @IsIn(Object.values(NotificationKindName))
  kind = '';

  @IsString()
  appointmentId = '';

  @IsISO8601()
  startsAt = '';

  @IsISO8601()
  sentAt = '';
}
