import type { FileStorage } from '@ddd-ts-kit/kernel';
import { S3FileStorage, s3ClientOf } from '@ddd-ts-kit/s3';
import type { FilesConfig } from '{{alias.platform}}/config/read-files{{alias.ext}}';

/** Where the content of files lives: a bucket of the S3 protocol, MinIO in the compose stack, never the database. */
export function openFiles(config: FilesConfig): FileStorage {
  const { bucket, ...settings } = config;

  return new S3FileStorage({ client: s3ClientOf(settings), bucket });
}
