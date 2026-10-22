import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { FileContent } from '../../application/files/file-content';
import { FileError } from '../../application/files/file-error';
import { assertFileKey } from '../../application/files/assert-file-key';
import type { FileMetadata } from '../../application/files/file-metadata';
import type { FileSource } from '../../application/files/file-source';
import type { ListedFile } from '../../application/files/listed-file';
import { mediaTypeOf } from '../../application/files/media-type-of';
import type { PutOptions } from '../../application/files/put-options';
import type { StoredFile } from '../../application/files/stored-file';
import type { Clock } from '../../application/ports/clock';
import { SystemClock } from '../clock/system-clock';
import { collect } from './collect';
import { FileInspection } from './file-inspection';
import type { SignedLinkOptions } from './signed-link-options';
import { SelfSignedFileStorage } from './self-signed-file-storage';

interface Held {
  readonly bytes: Buffer;
  readonly metadata: FileMetadata;
}

/** The storage of the tests: files in a map, the same contract as every connector, links served by the application. */
export class InMemoryFileStorage extends SelfSignedFileStorage {
  private readonly files = new Map<string, Held>();

  private readonly clock: Clock;

  constructor(options: SignedLinkOptions = {}) {
    super(options);
    this.clock = options.clock ?? new SystemClock();
  }

  /** The keys held, sorted: what a test asserts about the storage, for instance that a rollback left none. */
  keys(): readonly string[] {
    return [...this.files.keys()].sort();
  }

  async put(key: string, content: FileSource, options: PutOptions): Promise<StoredFile> {
    assertFileKey(key);
    const inspection = new FileInspection(options.maxBytes === undefined ? {} : { maxBytes: options.maxBytes });
    const chunks: Buffer[] = [];

    await pipeline(content, inspection, collect(chunks));

    const { size, checksum } = inspection;
    const mediaType = mediaTypeOf(options.mediaType);

    this.files.set(key, {
      bytes: Buffer.concat(chunks),
      metadata: { key, size, mediaType, checksum, lastModified: this.clock.now() },
    });

    return { key, size, mediaType, checksum };
  }

  get(key: string): Promise<FileContent | undefined> {
    const held = this.files.get(assertFileKey(key));

    return Promise.resolve(
      held === undefined ? undefined : { metadata: held.metadata, stream: Readable.from([held.bytes]) },
    );
  }

  stat(key: string): Promise<FileMetadata | undefined> {
    return Promise.resolve(this.files.get(assertFileKey(key))?.metadata);
  }

  delete(key: string): Promise<void> {
    this.files.delete(assertFileKey(key));

    return Promise.resolve();
  }

  copy(from: string, to: string): Promise<void> {
    const held = this.held(from);

    this.files.set(assertFileKey(to), {
      bytes: held.bytes,
      metadata: { ...held.metadata, key: to, lastModified: this.clock.now() },
    });

    return Promise.resolve();
  }

  async move(from: string, to: string): Promise<void> {
    await this.copy(from, to);

    if (from !== to) {
      this.files.delete(from);
    }
  }

  async *list(prefix: string): AsyncIterable<ListedFile> {
    for (const { metadata } of [...this.files.values()].filter((held) => held.metadata.key.startsWith(prefix))) {
      yield { key: metadata.key, size: metadata.size, lastModified: metadata.lastModified };
    }
  }

  private held(key: string): Held {
    const held = this.files.get(assertFileKey(key));

    if (held === undefined) {
      throw FileError.notFound(key);
    }

    return held;
  }
}
