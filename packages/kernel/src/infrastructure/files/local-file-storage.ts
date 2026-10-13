import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { FileContent } from '../../application/files/file-content.js';
import { FileError } from '../../application/files/file-error.js';
import type { FileMetadata } from '../../application/files/file-metadata.js';
import type { FileSource } from '../../application/files/file-source.js';
import type { ListedFile } from '../../application/files/listed-file.js';
import { mediaTypeOf } from '../../application/files/media-type-of.js';
import type { PutOptions } from '../../application/files/put-options.js';
import type { StoredFile } from '../../application/files/stored-file.js';
import { FileInspection } from './file-inspection.js';
import type { LocalFileStorageOptions } from './local-file-storage-options.js';
import { LocalPaths } from './local-paths.js';
import { isStoredMetadata } from './is-stored-metadata.js';
import type { StoredMetadata } from './stored-metadata.js';
import { SelfSignedFileStorage } from './self-signed-file-storage.js';

/**
 * The storage of development: a directory, each file under its key and what the file system does
 * not know beside it in `.metadata/`. A write goes to `.incoming/` first and is renamed into place,
 * so a failed or refused write leaves nothing under its key. One machine only: in a deployment
 * with several instances, use an object store.
 */
export class LocalFileStorage extends SelfSignedFileStorage {
  private readonly paths: LocalPaths;

  constructor(options: LocalFileStorageOptions) {
    super(options);
    this.paths = new LocalPaths(options.directory);
  }

  async put(key: string, content: FileSource, options: PutOptions): Promise<StoredFile> {
    const target = this.paths.contentOf(key);
    const incoming = this.paths.incoming();
    const inspection = new FileInspection(options.maxBytes === undefined ? {} : { maxBytes: options.maxBytes });

    await fs.mkdir(path.dirname(incoming), { recursive: true });

    await pipeline(content, inspection, createWriteStream(incoming)).catch(async (error: unknown) => {
      await fs.rm(incoming, { force: true });
      throw error;
    });

    const stored = {
      key,
      size: inspection.size,
      mediaType: mediaTypeOf(options.mediaType),
      checksum: inspection.checksum,
    };

    await this.writeMetadata(key, stored);
    await placed(incoming, target);

    return stored;
  }

  async get(key: string): Promise<FileContent | undefined> {
    const metadata = await this.stat(key);

    return metadata === undefined ? undefined : { metadata, stream: createReadStream(this.paths.contentOf(key)) };
  }

  async stat(key: string): Promise<FileMetadata | undefined> {
    const found = await fs.stat(this.paths.contentOf(key)).catch(() => undefined);

    if (found?.isFile() !== true) {
      return undefined;
    }

    const { mediaType, checksum } = await this.readMetadata(key);

    return { key, size: found.size, mediaType, lastModified: found.mtime, ...(checksum === '' ? {} : { checksum }) };
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.paths.contentOf(key), { force: true });
    await fs.rm(this.paths.metadataOf(key), { force: true });
  }

  async copy(from: string, to: string): Promise<void> {
    await this.existing(from);
    await this.writeMetadata(to, await this.readMetadata(from));
    await fs.mkdir(path.dirname(this.paths.contentOf(to)), { recursive: true });
    await fs.copyFile(this.paths.contentOf(from), this.paths.contentOf(to));
  }

  async move(from: string, to: string): Promise<void> {
    await this.existing(from);
    await this.writeMetadata(to, await this.readMetadata(from));
    await placed(this.paths.contentOf(from), this.paths.contentOf(to));

    if (from !== to) {
      await fs.rm(this.paths.metadataOf(from), { force: true });
    }
  }

  async *list(prefix: string): AsyncIterable<ListedFile> {
    const entries = await fs.readdir(this.paths.root, { recursive: true, withFileTypes: true }).catch(() => []);

    for (const entry of entries.filter((found) => found.isFile())) {
      const key = this.paths.keyOf(path.join(entry.parentPath, entry.name));

      if (key?.startsWith(prefix) === true) {
        const { size, mtime } = await fs.stat(this.paths.contentOf(key));

        yield { key, size, lastModified: mtime };
      }
    }
  }

  private async existing(key: string): Promise<void> {
    if ((await this.stat(key)) === undefined) {
      throw FileError.notFound(key);
    }
  }

  private async readMetadata(key: string): Promise<StoredMetadata> {
    const text = await fs.readFile(this.paths.metadataOf(key), 'utf8').catch(() => '');
    const value: unknown = text === '' ? undefined : JSON.parse(text);

    return isStoredMetadata(value) ? value : { mediaType: 'application/octet-stream', checksum: '' };
  }

  private async writeMetadata(key: string, metadata: StoredMetadata): Promise<void> {
    const file = this.paths.metadataOf(key);
    const { mediaType, checksum } = metadata;

    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify({ mediaType, checksum }));
  }
}

async function placed(from: string, to: string): Promise<void> {
  await fs.mkdir(path.dirname(to), { recursive: true });
  await fs.rename(from, to);
}
