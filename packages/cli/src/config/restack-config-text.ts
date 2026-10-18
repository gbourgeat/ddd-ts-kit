import type { Config } from './config.js';
import { editConfigText } from './edit-config-text.js';
import { isRecord } from './values/is-record.js';
import { writtenStack } from './written-stack.js';

type Restacked = Pick<
  Config,
  'initVersion' | 'importAlias' | 'importExtension' | 'stack' | 'deviations' | 'worker' | 'ci' | 'sdk'
>;

/**
 * The config text of an initialised project after `init --force`: the stack and the spelling of
 * the imports are the ones the run resolved, every other key stays as the team wrote it (the
 * contexts and their upstreams, the rules, the limits, the allowed packages, a key the kit does
 * not know). "importExtension" is written next to "importAlias" when the file did not say it, and
 * "initVersion", the version of the CLI that rewrote the files, first.
 */
export function restackConfigText(content: string, config: Restacked): string {
  return editConfigText(content, (raw) => {
    const initVersion = config.initVersion ?? raw['initVersion'];
    const spelled = { importAlias: config.importAlias, importExtension: config.importExtension };
    const others = Object.entries(raw).filter(([key]) => !(key in spelled) && key !== 'initVersion');
    const at = Object.keys(raw).indexOf('importAlias');
    const before = at === -1 ? others.length : others.filter(([key]) => Object.keys(raw).indexOf(key) < at).length;

    Object.keys(raw).forEach((key) => Reflect.deleteProperty(raw, key));

    Object.assign(
      raw,
      initVersion === undefined ? {} : { initVersion },
      Object.fromEntries(others.slice(0, before)),
      spelled,
      Object.fromEntries(others.slice(before)),
    );

    raw['stack'] = writtenStack(config.stack);
    keepRecorded(raw, config);
  });
}

/** What the run added over the file: a deviation it just recorded, a worker it found on disk, the extra jobs of the pipeline, the clients `--sdk` asked for. */
function keepRecorded(raw: Record<string, unknown>, { deviations, worker, ci, sdk }: Restacked): void {
  const written: unknown[] = Array.isArray(raw['deviations']) ? raw['deviations'] : [];

  if (deviations.length > written.length) {
    raw['deviations'] = [...written, ...deviations.slice(written.length)];
  }

  if (worker) {
    raw['worker'] = true;
  }

  if (sdk !== undefined && raw['sdk'] === undefined) {
    raw['sdk'] = { name: sdk.name };
  }

  if (ci.extras.length > 0) {
    raw['ci'] = { ...(isRecord(raw['ci']) ? raw['ci'] : {}), extras: ci.extras };
  } else {
    Reflect.deleteProperty(raw, 'ci');
  }
}
