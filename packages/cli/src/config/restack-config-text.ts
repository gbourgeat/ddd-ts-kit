import type { Config } from './config.js';
import { editConfigText } from './edit-config-text.js';
import { writtenStack } from './written-stack.js';

type Restacked = Pick<Config, 'importAlias' | 'importExtension' | 'stack' | 'deviations' | 'worker'>;

/**
 * The config text of an initialised project after `init --force`: the stack and the spelling of
 * the imports are the ones the run resolved, every other key stays as the team wrote it (the
 * contexts and their upstreams, the rules, the limits, the allowed packages, a key the kit does
 * not know). "importExtension" is written next to "importAlias" when the file did not say it.
 */
export function restackConfigText(content: string, config: Restacked): string {
  return editConfigText(content, (raw) => {
    const spelled = { importAlias: config.importAlias, importExtension: config.importExtension };
    const others = Object.entries(raw).filter(([key]) => !(key in spelled));
    const at = Object.keys(raw).indexOf('importAlias');
    const before = at === -1 ? others.length : others.filter(([key]) => Object.keys(raw).indexOf(key) < at).length;

    Object.keys(raw).forEach((key) => Reflect.deleteProperty(raw, key));
    Object.assign(raw, Object.fromEntries(others.slice(0, before)), spelled, Object.fromEntries(others.slice(before)));
    raw['stack'] = writtenStack(config.stack);
    keepRecorded(raw, config);
  });
}

/** What the run added over the file: a deviation it just recorded, a worker it found on disk. */
function keepRecorded(raw: Record<string, unknown>, { deviations, worker }: Restacked): void {
  const written: unknown[] = Array.isArray(raw['deviations']) ? raw['deviations'] : [];

  if (deviations.length > written.length) {
    raw['deviations'] = [...written, ...deviations.slice(written.length)];
  }

  if (worker) {
    raw['worker'] = true;
  }
}
