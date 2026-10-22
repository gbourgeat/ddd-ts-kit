import type { Config } from '../config';
import type { RenderContext } from '../templating';
import { PROVIDED_BROKERS } from './provided-brokers';

/**
 * Where unexpected failures are reported, and which hooks exist to hang the dead letters on: the
 * `onFailure` of a provided broker, and the one of the outbox relay.
 */
export function errorVars(config: Config): RenderContext {
  const { errors, broker } = config.stack;
  const sentry = errors === 'sentry';

  return { sentry, none: !sentry, broker: sentry && PROVIDED_BROKERS.includes(broker) };
}
