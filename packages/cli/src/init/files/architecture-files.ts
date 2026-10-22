import type { Config } from '../../config';
import { wiringFamily } from '../../generate/wiring-family';
import type { InitFile } from './init-file';

/**
 * The proof that the platform wires alone, which each context then joins: there from the start,
 * so that a project has a spec to run, and a use for the platform of its tests, before its
 * first context.
 */
export function architectureFiles(config: Config): InitFile[] {
  return [['test/architecture/extractable.spec.ts', `architecture/extractable.${wiringFamily(config)}.spec.ts.tpl`]];
}
