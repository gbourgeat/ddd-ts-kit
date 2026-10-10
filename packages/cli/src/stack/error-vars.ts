import type { Config } from '../config/index.js';
import type { RenderContext } from '../templating/index.js';
import { PROVIDED_BROKERS } from './provided-brokers.js';

/**
 * Where unexpected failures are reported, and which hooks exist to hang the dead letters on: the
 * `onFailure` of a provided broker, and the one of the outbox relay.
 */
export function errorVars(config: Config): RenderContext {
  const { errors, broker } = config.stack;
  const sentry = errors === 'sentry';

  return { sentry, none: !sentry, broker: sentry && PROVIDED_BROKERS.includes(broker) };
}
