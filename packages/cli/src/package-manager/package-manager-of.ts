import { isOneOf, PACKAGE_MANAGERS, type Stack } from '../config';
import { isRecord } from '../config/values/is-record';

/** The package manager a config file names, read from its text alone; npm when it names none or cannot be read. */
export function packageManagerOf(configText: string | undefined): Stack['packageManager'] {
  try {
    const parsed: unknown = JSON.parse(configText ?? '{}');
    const stack: unknown = isRecord(parsed) ? parsed['stack'] : undefined;
    const named: unknown = isRecord(stack) ? stack['packageManager'] : undefined;

    return isOneOf(PACKAGE_MANAGERS, named) ? named : 'npm';
  } catch {
    return 'npm';
  }
}
