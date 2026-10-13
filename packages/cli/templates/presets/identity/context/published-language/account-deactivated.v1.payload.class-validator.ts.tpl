import { IsString } from 'class-validator';

/** An account was deactivated: its person signs in no more, and every context stops acting for it. Version 1: a field may be added, never renamed nor removed. */
export class AccountDeactivatedV1Payload {
  @IsString()
  accountId = '';
}
