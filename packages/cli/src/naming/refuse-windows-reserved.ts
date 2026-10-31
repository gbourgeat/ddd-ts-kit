import { CliError } from '../cli-error';
import type { Name } from './name';

/** The names Windows reserves for devices, whatever the case and the extension: `con.aggregate.ts` cannot be checked out on NTFS. */
const WINDOWS_RESERVED = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/;

/**
 * Refuses a name that is a file name Windows reserves, since the kit writes files and folders named after it.
 * `allowName` is the `--allow-name` of the command; undefined where the command has no such flag.
 */
export function refuseWindowsReserved(name: Name, what: string, allowName?: boolean): void {
  if (allowName === true || !WINDOWS_RESERVED.test(name.kebab)) {
    return;
  }

  throw new CliError(
    `"${name.pascal}" is a name Windows reserves for a device (CON, PRN, AUX, NUL, COM1 to COM9, LPT1 to LPT9): the files of this ${what} cannot be checked out there.`,
    `Rename the ${what}${allowName === undefined ? '' : ', or pass --allow-name if no one works on Windows'}.`,
  );
}
