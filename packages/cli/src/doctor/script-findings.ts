import type { Config } from '../config/index.js';
import { scriptsFor } from '../init/manifest/scripts-for.js';
import type { DoctorFinding } from './doctor-finding.js';

/** The scripts this version writes that package.json lacks, then the ones it writes otherwise, `dev` preloading `tracing` where the project keeps it. */
export function scriptFindings(
  config: Config,
  scripts: Readonly<Record<string, unknown>>,
  tracing?: string,
): DoctorFinding[] {
  return Object.entries(scriptsFor(config, tracing)).flatMap(([name, expected]): DoctorFinding[] => {
    const found = scripts[name];

    if (typeof found !== 'string') {
      return [{ area: 'script', name, problem: 'missing', expected }];
    }

    return found === expected ? [] : [{ area: 'script', name, problem: 'written otherwise', expected, found }];
  });
}
