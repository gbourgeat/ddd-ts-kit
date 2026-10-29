import type { MessagePlan, ReadField } from './message-plan';
import type { UseCase } from './use-case';

/** How one place of the generated code names what it hands the message: the actor and each field it read. */
export interface Passing {
  readonly actor: string;
  readonly field: (field: ReadField) => string;
}

/**
 * The construction of the message of a use case, the same wherever it is written (a controller, a
 * function route, a Nest method, the expectation of a spec): its actor when it is protected, then
 * each field the route reads, in the order of the constructor.
 */
export function messageCall(useCase: UseCase, plan: MessagePlan, passing: Passing): string {
  const actor = useCase.isProtected ? [passing.actor] : [];

  return `new ${useCase.message}(${[...actor, ...plan.read.map(passing.field)].join(', ')})`;
}
