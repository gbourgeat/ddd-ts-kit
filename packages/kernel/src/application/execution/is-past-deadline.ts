import type { ExecutionContext } from './execution-context.js';

export function isPastDeadline(context: ExecutionContext, now: Date): boolean {
  return context.deadline !== undefined && context.deadline.getTime() <= now.getTime();
}
