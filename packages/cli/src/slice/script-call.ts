import type { Stack } from '../config';

/** One script of the project's package.json to run, with the arguments handed over to it. */
export interface ScriptCall {
  readonly root: string;
  readonly manager: Stack['packageManager'];
  readonly script: string;
  readonly args?: readonly string[];
}
