import type { Name } from '../../../naming/index.js';
import type { CommandInput } from './command-input.js';

/** The command a job sends, as its file and the wiring of its context say it. */
export interface SentCommand {
  readonly name: Name;
  /** The command carries its actor: the job sends it as its own system actor, which has to hold the permission. */
  readonly isProtected: boolean;
  /** The permission the command requires, as `<context>:<aggregate>.<action>`; undefined when it is not written where the generator reads it. */
  readonly permission: string | undefined;
  /** The constructor of the command takes the instant the work is for, right after the actor: what a scheduled job hands it. */
  readonly takesInstant: boolean;
  /** For a background job: every parameter of the constructor past the actor, which its payload carries. */
  readonly inputs: readonly CommandInput[];
}
