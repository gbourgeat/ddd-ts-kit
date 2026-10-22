import { isRecord } from './is-record';

/** The object a JSON file of settings holds, or nothing when it holds anything else. */
export function jsonObject(text: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(text);

    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}
