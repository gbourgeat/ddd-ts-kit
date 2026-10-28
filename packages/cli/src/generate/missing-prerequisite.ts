import { CliError } from '../cli-error';

/**
 * A refusal of the generator for what a command builds on and an earlier command creates: an
 * aggregate, a port, a use case, a route group. It names that command, so that `plan-waves` can
 * say which row of the plan generates it, or that none does.
 */
export class MissingPrerequisite extends CliError {
  constructor(
    message: string,
    /** `ddd-ts-kit generate aggregate billing Invoice`: the command that creates what is missing. */
    readonly createdBy: string,
  ) {
    super(message, `Create it first with \`${createdBy}\`.`);
  }
}
