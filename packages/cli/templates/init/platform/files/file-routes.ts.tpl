import { signedFileRoutes, type Route } from '@ddd-ts-kit/http';
import { ServedFileStorage, type FileStorage } from '@ddd-ts-kit/kernel';

/**
 * The routes that answer the signed links of a storage the application serves itself: the local
 * directory, or the memory of the tests. None for an object store, which answers its own links.
 */
export function fileRoutes(storage: FileStorage): readonly Route[] {
  return storage instanceof ServedFileStorage ? signedFileRoutes(storage) : [];
}
