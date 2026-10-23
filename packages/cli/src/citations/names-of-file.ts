import path from 'node:path';
import { toName } from '../naming/to-name';

/** Parts of a file name that make it a test, a declaration file or a fake, never a role. */
const NOT_A_ROLE = new Set(['spec', 'test', 'fake', 'e2e', 'd']);

/**
 * The names the name of a file gives, `<stem>.<suffix>.ts`: `verify-occupancy.handler.ts` gives
 * `VerifyOccupancy` and `VerifyOccupancyHandler`. A spec, a fake, or a file without a role
 * suffix gives none.
 */
export function namesOfFile(file: string): string[] {
  const [stem = '', suffix = '', extension, ...more] = path.posix.basename(file).split('.');

  if (extension !== 'ts' || more.length > 0 || stem === '' || NOT_A_ROLE.has(suffix)) {
    return [];
  }

  const name = toName(stem).pascal;

  return [name, `${name}${toName(suffix).pascal}`];
}
