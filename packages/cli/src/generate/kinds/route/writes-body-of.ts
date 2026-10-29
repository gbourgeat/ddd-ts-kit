import type { MessagePlan } from './message-plan';

/** Whether the route writes the schema of its body field by field. */
export function writesBodyOf(plan: MessagePlan): boolean {
  return plan.read.some((field) => field.from === 'body');
}
