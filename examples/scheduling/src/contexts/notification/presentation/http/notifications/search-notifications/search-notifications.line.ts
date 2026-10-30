import { IsISO8601, IsIn, IsString } from 'class-validator';
import { NotificationKindName } from '@/contexts/notification/domain/vocabularies/notification-kind-name.vocabulary';

export class SearchNotificationsLine {
  @IsString()
  declare id: string;

  @IsIn(Object.values(NotificationKindName))
  declare kind: string;

  @IsString()
  declare appointmentId: string;

  @IsISO8601()
  declare startsAt: string;

  @IsISO8601()
  declare sentAt: string;
}
