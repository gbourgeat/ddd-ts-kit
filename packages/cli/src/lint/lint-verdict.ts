import type { LintAnswer } from './parse-lint-answer';

export interface LintVerdict {
  readonly errors: number;
  readonly warnings: number;
}

const ERROR = 2;

/** An error fails the lint, and so does a warning: a rule of the kit reports what it reports, a new one included. */
export function lintVerdict({ messages }: Pick<LintAnswer, 'messages'>): LintVerdict {
  const errors = messages.filter((message) => message.severity === ERROR).length;

  return { errors, warnings: messages.length - errors };
}
