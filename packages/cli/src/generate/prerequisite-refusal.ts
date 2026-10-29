import { CliError } from '../cli-error';
import { MissingPrerequisite } from './missing-prerequisite';

/**
 * The refusal of a file a command builds on that is not what it needs: a missing file is a
 * prerequisite an earlier command creates (`MissingPrerequisite`), a file that is there but wrong
 * is a mistake to fix by hand (`CliError`).
 */
export function prerequisiteRefusal(missing: boolean, message: string, fix: string): CliError {
  return missing ? new MissingPrerequisite(message, fix) : new CliError(message, fix);
}
