import type { Config } from '../config/index.js';
import { writeAdr } from '../generate/kinds/write-adr.js';
import type { Workspace } from '../workspace/index.js';

/** `--allow-no-outbox`: the choice is kept, with the decision record and the config entry that make it a recorded deviation. */
export function recordNoOutbox(ws: Workspace, config: Config, allowNoOutbox: string | undefined): Config {
  const reason = allowNoOutbox?.trim() ?? '';
  const { orm, events } = config.stack;
  const recorded = config.deviations.some((deviation) => deviation.what === 'stack.events');

  if (reason === '' || orm === 'none' || events === 'outbox' || recorded) return config;

  const adr = writeAdr(ws, { title: 'Publish integration events without the transactional outbox', deviation: { what: 'stack.events', reason } });

  return { ...config, deviations: [...config.deviations, { what: 'stack.events', adr, reason }] };
}
