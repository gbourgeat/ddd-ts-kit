import { isTestFile } from '../../project/is-test-file.js';
import { locate } from '../../project/locate.js';
import type { Config } from '../../project/config.js';

/** `domain/repositories/*.repository.ts` and `application/ports/*.port.ts` of a context: where a port is declared. */
export function isPortFile(config: Config, file: string): boolean {
  const location = locate(config, file);

  if (location.area !== 'context' || isTestFile(file, location)) return false;

  const [folder] = location.inside;
  const isRepository = location.layer === 'domain' && folder === 'repositories' && file.endsWith('.repository.ts');

  return isRepository || (location.layer === 'application' && folder === 'ports' && file.endsWith('.port.ts'));
}
