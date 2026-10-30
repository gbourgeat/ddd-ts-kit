import { createHash, type Hash } from 'node:crypto';
import { Transform, type TransformCallback } from 'node:stream';
import { acceptsMediaType } from '../../application/files/accepts-media-type';
import { contentMatches } from '../../application/files/content-matches';
import { FileError } from '../../application/files/file-error';
import type { ContentExpectation } from '../../application/files/content-expectation';
import type { InspectionLimits } from '../../application/files/inspection-limits';

/** Enough bytes for every signature, and for a fair judgement of text. */
const HEAD_BYTES = 4_096;

/**
 * A pass-through for content on its way to a storage: counts it and fails beyond `maxBytes`,
 * hashes it, and when an expectation is given holds back the first bytes until they prove the
 * declared media type. Nothing of a refused content goes on. Read `size` and `checksum` once the
 * stream has finished.
 */
export class FileInspection extends Transform {
  size = 0;

  private readonly hash: Hash = createHash('sha256');

  private held: Buffer[] = [];

  /** What the first bytes still have to prove; nothing once they did, or when nothing was expected. */
  private pending: ContentExpectation | undefined;

  constructor(private readonly limits: InspectionLimits = {}) {
    super();
    this.pending = limits.expected;
  }

  get checksum(): string {
    return `sha256:${this.hash.copy().digest('hex')}`;
  }

  override _transform(chunk: unknown, _encoding: BufferEncoding, done: TransformCallback): void {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk instanceof Uint8Array ? chunk : String(chunk));

    this.size += bytes.length;

    if (this.limits.maxBytes !== undefined && this.size > this.limits.maxBytes) {
      done(FileError.tooLarge(this.limits.maxBytes));

      return;
    }

    this.hash.update(bytes);
    this.pass(bytes, false, done);
  }

  override _flush(done: TransformCallback): void {
    this.pass(Buffer.alloc(0), true, done);
  }

  private pass(bytes: Buffer, ended: boolean, done: TransformCallback): void {
    const expected = this.pending;

    if (expected === undefined) {
      done(null, bytes);

      return;
    }

    this.held.push(bytes);
    const head = Buffer.concat(this.held);

    if (head.length < HEAD_BYTES && !ended) {
      done();

      return;
    }

    this.held = [];
    this.pending = undefined;
    done(refusalOf(head, expected), head);
  }
}

function refusalOf(head: Buffer, expected: ContentExpectation): FileError | null {
  const valid =
    acceptsMediaType(expected.accepted, expected.mediaType) &&
    contentMatches(head.subarray(0, HEAD_BYTES), expected.mediaType);

  return valid ? null : FileError.unsupportedMediaType(expected.mediaType, expected.accepted);
}
