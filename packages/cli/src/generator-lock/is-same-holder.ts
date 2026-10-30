import type { LockHolder } from './lock-holder';

/** Whether the lock is still held by the command that took it at `startedAt` as process `pid`: not released and taken again meanwhile. */
export function isSameHolder(
  holder: LockHolder | undefined,
  { startedAt, pid }: Pick<LockHolder, 'startedAt' | 'pid'>,
): boolean {
  return holder !== undefined && holder.startedAt === startedAt && holder.pid === pid;
}
