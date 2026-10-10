import type { Config } from '../../../config/index.js';
import type { Workspace } from '../../../workspace/index.js';
import { editJson } from './edit-json.js';
import { recordOf } from './record-of.js';

/** An entry point under `apps/`: the source file, and the compiled one a start script and an image run. */
export class EntryPoint {
  readonly source: string;

  readonly compiled: string;

  constructor(
    private readonly config: Config,
    readonly name: string,
  ) {
    this.source = `${config.sourceRoot}/apps/${name}/main.ts`;
    this.compiled = `dist/${this.source.replace(/\.ts$/, '.js')}`;
  }

  /** The start script, and the entry knip has to know: nothing imports an entry point. */
  declareIn(ws: Workspace): void {
    const pattern = `${this.config.sourceRoot}/apps/*/main.ts`;

    editJson(ws, 'package.json', (manifest) => {
      manifest['scripts'] = { ...recordOf(manifest['scripts']), [`start:${this.name}`]: `node ${this.compiled}` };
    });

    editJson(ws, 'knip.json', (knip) => {
      const entries: unknown[] = Array.isArray(knip['entry']) ? knip['entry'] : [];

      if (!entries.includes(pattern)) {
        knip['entry'] = [...entries, pattern];
      }
    });
  }
}
