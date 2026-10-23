import { isRecord } from '../check/support/is-record';

/** The edit of the config that says the form the refusals of the project are written in now. */
export function sayRefusals(form: 'named' | 'factories'): (raw: Record<string, unknown>) => void {
  return (raw) => {
    raw['stack'] = { ...(isRecord(raw['stack']) ? raw['stack'] : {}), refusals: form };
  };
}
