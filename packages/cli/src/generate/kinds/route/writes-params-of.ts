import type { MessagePlan } from './message-plan';

/** Under Standard Schema the path parameters have no schema unless the route reads a field from them. */
export function writesParamsOf(validation: string, plan: MessagePlan): boolean {
  return validation === 'standard-schema' && plan.read.some((field) => field.from === 'params');
}
