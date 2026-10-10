import type { Message } from 'amqplib';
import { ATTEMPT_HEADER } from './headers.js';
import { headersOf } from './headers-of.js';

/** Which delivery this is, starting at 1: the header is set when the bus schedules a retry. */
export function attemptOf(message: Message): number {
  const attempt = headersOf(message)[ATTEMPT_HEADER];

  return typeof attempt === 'number' && Number.isInteger(attempt) && attempt >= 1 ? attempt : 1;
}
