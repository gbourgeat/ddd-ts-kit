import { isTestFile } from '../../project/is-test-file';
import { locate } from '../../project/locate';
import type { Config } from '../../project/config';

/** `application/scheduling/*.job.ts` of a context: the one place a job lives. */
export function isJobFile(config: Config, file: string): boolean {
  const location = locate(config, file);

  if (location.area !== 'context' || isTestFile(file, location)) {
    return false;
  }

  return location.layer === 'application' && location.inside[0] === 'scheduling' && file.endsWith('.job.ts');
}
