import { CliError } from '../cli-error.js';
import type { Scope } from './scope.js';

export interface Prerequisite {
  /** Path inside the context. */
  readonly file: string;
  readonly what: string;
  readonly createdBy: string;
}

/** Stops with the command that creates what a kind builds on, when it is missing. */
export function requireFile(scope: Scope, prerequisite: Prerequisite): void {
  const target = `${scope.dir}/${prerequisite.file}`;

  if (scope.ws.exists(target)) {
    return;
  }

  throw new CliError(
    `${prerequisite.what} does not exist in "${scope.context.kebab}" (${target}).`,
    `Create it first with \`${prerequisite.createdBy}\`.`,
  );
}
