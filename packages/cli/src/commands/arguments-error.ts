import { CliError } from '../cli-error';

/** An option or a value the parser of a command refuses: the CLI answers it with the usage of that command. */
export class ArgumentsError extends CliError {}
