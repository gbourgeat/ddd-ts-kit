import type { IntegrationEvent } from '../../application/events/integration-event.js';
import type { Result } from '../../domain/result/result.js';

/**
 * What an integration event handler needs from the declaration of an integration event. A definition made by
 * `defineIntegrationEvent` of `@ddd-ts-kit/events` fits as it is.
 */
export interface EventContract<Payload> {
  readonly type: string;
  readonly version: number;
  parse(event: IntegrationEvent): Result<IntegrationEvent<Payload>, { readonly reason: string }>;
}
