import { foundPrerequisite } from './found-prerequisite';
import { MissingPrerequisite } from './missing-prerequisite';
import type { Scope } from './scope';

export interface Prerequisite {
  /** Path inside the context. */
  readonly file: string;
  readonly what: string;
  readonly createdBy: string;
}

/** Stops with the command that creates what a kind builds on, when it is missing. */
export function requireFile(scope: Scope, prerequisite: Prerequisite): void {
  const target = `${scope.dir}/${prerequisite.file}`;

  if (foundPrerequisite(scope, target)) {
    return;
  }

  throw new MissingPrerequisite(
    `${prerequisite.what} does not exist in "${scope.context.kebab}" (${target}).`,
    `Create it first with \`${prerequisite.createdBy}\`.`,
  );
}
