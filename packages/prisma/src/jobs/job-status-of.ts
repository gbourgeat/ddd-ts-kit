import { QueuedJobStatus } from '@ddd-ts-kit/kernel';

const STATUSES: readonly string[] = Object.values(QueuedJobStatus);

export function jobStatusOf(status: string): QueuedJobStatus {
  if (isStatus(status)) {
    return status;
  }

  throw new TypeError(`Unknown background job status "${status}"`);
}

function isStatus(status: string): status is QueuedJobStatus {
  return STATUSES.includes(status);
}
