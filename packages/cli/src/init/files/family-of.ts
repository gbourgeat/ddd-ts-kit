import type { Config } from '../../config';

/** The nest module wires by hand inside a Nest provider, so it shares the manual family. */
export function familyOf(config: Config): 'tsyringe' | 'manual' {
  return config.stack.di === 'tsyringe' ? 'tsyringe' : 'manual';
}
