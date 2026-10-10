import type { Config } from '../../config/index.js';
import type { InitFile } from './init-file.js';

/**
 * A file of the platform and its template under `templates/init/platform/`: the same relative
 * path, with the variant of the stack before the extension when the file has several
 * (`http/start-http-server.ts` from `http/start-http-server.express.ts.tpl`).
 */
export function platformFile(config: Config, file: string, variant?: string): InitFile {
  const template = variant === undefined ? file : file.replace(/(\.contract\.spec)?\.ts$/, (extension) => `.${variant}${extension}`);

  return [`${config.platformDir}/${file}`, `init/platform/${template}.tpl`];
}
