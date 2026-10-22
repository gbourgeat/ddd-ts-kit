import type { Config } from '../config';
import { dependenciesFor } from '../init/manifest/dependencies-for';
import type { DoctorFinding } from './doctor-finding';

/** The packages of the kit are released together: each one at the range this version writes. */
export const OF_THE_KIT = /^(?:ddd-ts-kit|@ddd-ts-kit\/.+)$/;

/**
 * The packages of the kit the project needs for its stack, missing or at another range than this
 * version writes: they are upgraded together, never one alone.
 */
export function packageFindings(config: Config, installed: Readonly<Record<string, unknown>>): DoctorFinding[] {
  const wanted = dependenciesFor(config);
  const expected = { ...wanted.dependencies, ...wanted.devDependencies };

  return Object.entries(expected)
    .filter(([name]) => OF_THE_KIT.test(name))
    .flatMap(([name, range]): DoctorFinding[] => {
      const found = installed[name];

      if (typeof found !== 'string') {
        return [{ area: 'package', name, problem: 'missing', expected: range }];
      }

      return found === range ? [] : [{ area: 'package', name, problem: 'other version', expected: range, found }];
    });
}
