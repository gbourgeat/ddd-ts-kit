import type { ExecutionContext } from './execution-context';

export function isPastDeadline(context: ExecutionContext, now: Date): boolean {
  return context.deadline !== undefined && context.deadline.getTime() <= now.getTime();
}
