import { LocalFileStorage, type FileStorage } from '@ddd-ts-kit/kernel';
import type { FilesConfig } from '{{alias.platform}}/config/read-files{{alias.ext}}';

/**
 * Where the content of files lives: a directory of this machine, never the database. The
 * application answers its signed links itself, under `/files`. One machine only: before running
 * several instances, move to an object store (`ddd-ts-kit init --force --storage s3`).
 */
export function openFiles(config: FilesConfig): FileStorage {
  const { directory, publicUrl, signingSecret } = config;

  return new LocalFileStorage({ directory, baseUrl: publicUrl, ...(signingSecret === undefined ? {} : { secret: signingSecret }) });
}
