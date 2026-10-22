import type { Actor } from '@ddd-ts-kit/kernel';
import { ForbiddenError } from '../error/forbidden-error';
import type { FieldDecider } from '../field-access/field-decider';
import type { FormRequirement } from './form-requirement';

/** Who asks for a form, how their rights are decided, and the values they ask it with. */
export interface FormAsker {
  readonly actor: Actor;
  readonly decide: FieldDecider | undefined;
  readonly values: Readonly<Record<string, unknown>>;
}

/**
 * Refuses with 403 the caller who may not run the use case a form describes, decided as the use
 * case decides it and recorded as an act: they learn nothing of its fields. Without a decider,
 * nobody is given a form that declares a requirement.
 */
export async function assertOpens(requires: FormRequirement | undefined, asker: FormAsker): Promise<void> {
  if (requires === undefined) {
    return;
  }

  const { actor, decide, values } = asker;
  const context = requires.context?.(values, actor);

  const question = {
    actor,
    requirement: requires,
    subject: requires.subject?.(values),
    recorded: true,
    ...(context === undefined ? {} : { context }),
  };

  if (decide === undefined || !(await decide(question))) {
    throw new ForbiddenError('The caller may not run the use case this form describes.');
  }
}
