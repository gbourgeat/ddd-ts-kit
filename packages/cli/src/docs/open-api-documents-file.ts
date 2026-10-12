import type { Config } from '../config/index.js';

/** Where the split of the contract is kept, in the platform: the script and the running application both read it. */
export function openApiDocumentsFile(config: Config): string {
  return `${config.platformDir}/http/openapi-documents.ts`;
}
