import { FileError, type FileStorage } from '@ddd-ts-kit/kernel';
import { ContractSuite } from '../contract-suite';
import type { ContractRunner } from '../contract-runner';
import { chunksOf } from './chunks-of';
import type { FileStorageContractOptions } from './file-storage-contract-options';
import { readAll } from './read-all';

/** What the suites of the file storage contract share: the options, and reading back what was written. */
export abstract class FileStorageSuite extends ContractSuite<FileStorage> {
  constructor(
    runner: ContractRunner,
    protected readonly options: FileStorageContractOptions,
  ) {
    super(runner, () => options.createStorage());
  }

  protected async write(key: string, bytes: Uint8Array, mediaType = 'application/pdf'): Promise<void> {
    await this.subject.put(key, chunksOf(bytes), { mediaType });
  }

  protected async read(key: string): Promise<Uint8Array | undefined> {
    const content = await this.subject.get(key);

    return content === undefined ? undefined : readAll(content.stream);
  }

  /** The code of the `FileError` the work rejects with, `resolved` when it does not, the message of another error. */
  protected async codeOf(work: () => Promise<unknown>): Promise<string> {
    try {
      await work();

      return 'resolved';
    } catch (error) {
      return FileError.is(error) ? error.code : String(error);
    }
  }
}
