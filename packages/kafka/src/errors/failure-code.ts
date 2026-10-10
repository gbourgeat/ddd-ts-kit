import { errorCode } from '@ddd-ts-kit/events';

/**
 * What may be reported about an error of the client. librdkafka names its errors in `type`
 * (`ERR__MSG_TIMED_OUT`, `ERR_UNKNOWN_TOPIC_OR_PART`): that name is the code. Never the message.
 */
export function failureCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'type' in error) {
    const { type } = error;

    if (typeof type === 'string' && /^ERR_[A-Z_]+$/.test(type)) {
      return type;
    }
  }

  return errorCode(error);
}
