import type { Config } from '../config';
import { writeAdr } from '../generate/kinds/write-adr';
import type { Workspace } from '../workspace';

/** `--allow-no-outbox`: the choice is kept, with the decision record and the config entry that make it a recorded deviation. */
export function recordNoOutbox(ws: Workspace, config: Config, allowNoOutbox: string | undefined): Config {
  const reason = allowNoOutbox?.trim() ?? '';
  const { orm, events } = config.stack;
  const recorded = config.deviations.some((deviation) => deviation.what === 'stack.events');

  if (reason === '' || orm === 'none' || events === 'outbox' || recorded) {
    return config;
  }

  const adr = writeAdr(ws, {
    title: 'Publish integration events without the transactional outbox',
    deviation: { what: 'stack.events', reason },
  });

  return { ...config, deviations: [...config.deviations, { what: 'stack.events', adr, reason }] };
}
