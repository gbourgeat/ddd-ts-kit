import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { assertFileKey } from '../../application/files/assert-file-key';
import { resolvedInside } from './resolved-inside';

/** Where the local storage puts a key: its content, its metadata, and a private place for a write in progress. */
export class LocalPaths {
  readonly root: string;

  constructor(directory: string) {
    this.root = path.resolve(directory);
  }

  contentOf(key: string): string {
    return this.inside(assertFileKey(key).split('/'));
  }

  metadataOf(key: string): string {
    return this.inside(['.metadata', ...assertFileKey(key).split('/')]) + '.json';
  }

  incoming(): string {
    return this.inside(['.incoming', randomUUID()]);
  }

  /** The key of a file found under the root, or `undefined` for what the storage keeps for itself. */
  keyOf(file: string): string | undefined {
    const segments = path.relative(this.root, file).split(path.sep);

    return segments.some((segment) => segment.startsWith('.') || segment === '') ? undefined : segments.join('/');
  }

  private inside(segments: readonly string[]): string {
    return resolvedInside(this.root, segments);
  }
}
