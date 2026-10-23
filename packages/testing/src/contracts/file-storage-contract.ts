import type { ContractRunner } from './contract-runner';
import { ArrangementSuite } from './file-storage/arrangement-suite';
import { ContentSuite } from './file-storage/content-suite';
import type { FileStorageContractOptions } from './file-storage/file-storage-contract-options';
import { SignedLinksSuite } from './file-storage/signed-links-suite';

/**
 * What every connector of the kernel `FileStorage` port guarantees, the in-memory one included:
 * content streams in and out intact and measured, a refused write leaves nothing, keys never
 * leave their place, copies, moves and listings by key, and short signed links that grant one
 * action. A connector of your own (Google Cloud Storage, Azure Blob Storage) is done when it
 * passes this suite against the real service or its emulator.
 */
export function fileStorageContract(runner: ContractRunner, options: FileStorageContractOptions): void {
  new ContentSuite(runner, options).describe(`${options.name} (file storage contract: content)`);
  new ArrangementSuite(runner, options).describe(`${options.name} (file storage contract: copy, move, list)`);
  new SignedLinksSuite(runner, options).describe(`${options.name} (file storage contract: signed links)`);
}
