import { LOG_LEVELS } from '@ddd-ts-kit/kernel';
import type { LoggedLine } from '@ddd-ts-kit/testing/contracts';

/** A record of the kit format as the contract reads it: `level` by name, `message`, then the fields. */
export function loggedLine(record: Record<string, unknown>): LoggedLine {
  const { level, message, time: _time, ...fields } = record;
  const known = LOG_LEVELS.find((one) => one === level);

  if (known === undefined) throw new Error(`Not a level of the port: ${String(level)}`);

  return { level: known, message: String(message), fields };
}
