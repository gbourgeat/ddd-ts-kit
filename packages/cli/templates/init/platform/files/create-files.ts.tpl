import {
  AcceptEveryFileScanner,
  FileStaging,
  TenantFileKeys,
  type Clock,
  type ErrorReporter,
  type ExecutionScope,
  type FileKeys,
  type FileStorage,
  type IdGenerator,
} from '@ddd-ts-kit/kernel';

/** Where files live, the keys they are stored under and the staging that keeps them consistent with the database. */
export interface Files {
  readonly storage: FileStorage;
  readonly keys: FileKeys;
  readonly staging: FileStaging;
}

/** What files are built on: the foundations of the platform. */
interface Grounds {
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly scope: ExecutionScope;
  readonly errors: ErrorReporter;
}

/** Files as a capability of the platform: the keys generated on the server, under the tenant when there is one, and the staging. */
export function createFiles(storage: FileStorage, { clock, ids, scope, errors }: Grounds): Files {
  // TODO(platform): plug in a scanner of your own (an antivirus, a content check) before accepting files from people you do not know.
  const staging = new FileStaging(storage, new AcceptEveryFileScanner(), errors);

  return { storage, keys: new TenantFileKeys(ids, clock, scope), staging };
}
