import type { Config } from '../../config/index.js';
import { wiringFamily } from '../../generate/wiring-family.js';
import type { InitFile } from './init-file.js';

/**
 * The proof that the platform wires alone, which each context then joins: there from the start,
 * so that a project has a spec to run, and a use for the platform of its tests, before its
 * first context.
 */
export function architectureFiles(config: Config): InitFile[] {
  return [['test/architecture/extractable.spec.ts', `architecture/extractable.${wiringFamily(config)}.spec.ts.tpl`]];
}
