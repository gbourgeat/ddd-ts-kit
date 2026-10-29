import { FIRST_SERVER_STATUS, STATUSES } from './statuses';

export function statusTitle(status: number): string {
  return STATUSES[status]?.title ?? (status >= FIRST_SERVER_STATUS ? 'Server Error' : 'Client Error');
}
