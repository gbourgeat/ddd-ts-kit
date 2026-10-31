import type { Resolve } from '@ddd-ts-kit/di';
import { FileKeys, FileStaging, fileUploadsMiddleware, type BusMiddleware } from '@ddd-ts-kit/kernel';

/**
 * Stages the file a command carries (a `FileUpload`), after the permission and before the
 * transaction, so that no transaction waits while a client uploads. Resolved at each command
 * that carries a file: building the bus opens nothing.
 */
export function stagingUploads(resolve: Resolve): BusMiddleware {
  return fileUploadsMiddleware(() => ({ keys: resolve(FileKeys), staging: resolve(FileStaging) }));
}
