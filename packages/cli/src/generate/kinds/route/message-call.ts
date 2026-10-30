import { describedField } from './described-field';
import type { MessagePlan, ReadField, UnreadField } from './message-plan';
import type { UseCase } from './use-case';

/**
 * How one place of the generated code names what it hands the message: the actor and each field it
 * read. A place that hands the request over whole, the mapper of a controller, reads no field and
 * says nothing of them.
 */
export interface Passing {
  readonly actor: string;
  readonly field?: (field: ReadField) => string;
}

/** Where the request carries a field the route does not read yet, and what reading it takes: no comma, the arguments of the call are laid out at theirs. */
const ORIGINS: Readonly<Record<UnreadField['from'], string>> = {
  params: 'from the path parameter converted from its text',
  body: 'from the body where its schema declares it',
  request: 'from the request',
};

/**
 * The construction of the message of a use case, the same wherever it is written (a controller, a
 * function route, a Nest method, the expectation of a spec): its actor when it is protected, then
 * each field the route reads, in the order of the constructor, and for each field it does not read
 * a placeholder the type checker refuses until it is filled, named by its `TODO(domain)`.
 */
export function messageCall(useCase: UseCase, plan: MessagePlan, passing: Passing): string {
  const actor = useCase.isProtected ? [passing.actor] : [];

  const placeholders = plan.unread.map(
    (field) => `/* TODO(domain): read ${describedField(field)} ${ORIGINS[field.from]} */ undefined`,
  );

  const read = passing.field === undefined ? [] : plan.read.map(passing.field);

  return `new ${useCase.message}(${[...actor, ...read, ...placeholders].join(', ')})`;
}
