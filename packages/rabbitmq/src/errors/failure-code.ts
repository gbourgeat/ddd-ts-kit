import { errorCode } from '@ddd-ts-kit/events';

/**
 * What may be reported about a caught error. amqplib carries the AMQP reply code as a number
 * (`406` for an inequivalent declaration): it becomes `AMQP_406`. Never the message.
 */
export function failureCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const { code } = error;

    if (typeof code === 'number' && Number.isInteger(code)) {
      return `AMQP_${String(code)}`;
    }
  }

  return errorCode(error);
}
