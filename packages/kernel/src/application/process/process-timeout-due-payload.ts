import { err } from '../../domain/result/err';
import { ok } from '../../domain/result/ok';
import type { BackgroundJobPayloadSchema } from '../background/background-job-payload-schema';
import type { PayloadIssue } from '../personal-data/payload-issue';
import type { ProcessTimeoutDue } from './process-timeout-due';

/**
 * The schema of the payload of the timeout job of a process, the static `payload` of that job:
 * `static readonly payload = processTimeoutDuePayload`. Written in the kernel, which every
 * context reads, whatever validation library the project has.
 */
export const processTimeoutDuePayload: BackgroundJobPayloadSchema<ProcessTimeoutDue> = {
  parse(input) {
    const id = textOf(input, 'id');
    const timeout = textOf(input, 'timeout');

    if (id === undefined || timeout === undefined) {
      return err([...(id === undefined ? [issue('id')] : []), ...(timeout === undefined ? [issue('timeout')] : [])]);
    }

    return ok({ id, timeout });
  },
};

function textOf(input: unknown, name: string): string | undefined {
  const value: unknown = typeof input === 'object' && input !== null ? Reflect.get(input, name) : undefined;

  return typeof value === 'string' && value !== '' ? value : undefined;
}

function issue(path: string): PayloadIssue {
  return { path, code: 'invalid_type', message: `${path} is not a text.` };
}
