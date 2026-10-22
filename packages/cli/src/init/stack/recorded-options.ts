import type { Config } from '../../config';
import type { StackOptions } from './stack-options';

/** `init` offers two ways of publishing events: a third one written by hand in the config is kept as it is. */
const OFFERED_EVENTS = ['in-memory', 'outbox'];

type Recorded = Omit<StackOptions, 'force' | 'importAlias' | 'importExtension'>;

/**
 * The stack a config records, as the flags of `init` would ask for it: what `init --force` starts
 * from, so that a flag changes the choice it names and nothing else. The reason of a recorded
 * run without the outbox is given again with it.
 */
export function recordedOptions({ stack, deviations }: Pick<Config, 'stack' | 'deviations'>): Recorded {
  const { events, style, assembly, dependencies, ...choices } = stack;
  const noOutbox = deviations.find(({ what }) => what === 'stack.events')?.reason;

  return {
    ...choices,
    style,
    ...(style === 'declared' ? { assembly, dependencies } : {}),
    ...(OFFERED_EVENTS.includes(events) ? { events } : {}),
    ...(noOutbox === undefined ? {} : { allowNoOutbox: noOutbox }),
  };
}
