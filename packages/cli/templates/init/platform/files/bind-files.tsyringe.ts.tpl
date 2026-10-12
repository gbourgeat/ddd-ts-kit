import type { ModuleBuilder } from '@ddd-ts-kit/di';
import {
  AcceptEveryFileScanner,
  Clock,
  ErrorReporter,
  ExecutionScope,
  FileKeys,
  FileScanner,
  FileStaging,
  FileStorage,
  IdGenerator,
  TenantFileKeys,
} from '@ddd-ts-kit/kernel';

/**
 * The ports of files on a storage: the keys generated on the server, under the tenant when there
 * is one, the scanner a file passes before it is accepted, and the staging that keeps the storage
 * consistent with the database. The application and the handler specs bind them alike.
 */
export function bindFiles(builder: ModuleBuilder, storage: FileStorage): void {
  builder.bind(FileStorage).toValue(storage);
  // TODO(platform): bind a scanner of your own (an antivirus, a content check) before accepting files from people you do not know.
  builder.bind(FileScanner).toValue(new AcceptEveryFileScanner());

  builder
    .bind(FileKeys)
    .toFactory((resolve) => new TenantFileKeys(resolve(IdGenerator), resolve(Clock), resolve(ExecutionScope)));

  builder
    .bind(FileStaging)
    .toFactory((resolve) => new FileStaging(resolve(FileStorage), resolve(FileScanner), resolve(ErrorReporter)));
}
