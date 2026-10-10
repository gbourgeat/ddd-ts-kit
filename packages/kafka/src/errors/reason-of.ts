import { BrokerUnavailableError } from './broker-unavailable-error.js';
import { failureCode } from './failure-code.js';
import { PublishNotAcknowledgedError } from './publish-not-acknowledged-error.js';

/** The code of a failure of the cluster, whether the bus already named it or the client raised it. */
export function reasonOf(error: unknown): string {
  if (error instanceof BrokerUnavailableError || error instanceof PublishNotAcknowledgedError) {
    return error.reason;
  }

  return failureCode(error);
}
