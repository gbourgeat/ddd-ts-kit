import { randomBytes } from 'node:crypto';
import { assertExpiry } from '../../application/files/assert-expiry.js';
import type { DownloadUrlOptions } from '../../application/files/download-url-options.js';
import { assertFileKey } from '../../application/files/assert-file-key.js';
import type { FileSource } from '../../application/files/file-source.js';
import { mediaTypeOf } from '../../application/files/media-type-of.js';
import type { SignedDownload } from '../../application/files/signed-download.js';
import type { SignedUpload } from '../../application/files/signed-upload.js';
import type { SignedUrl } from '../../application/files/signed-url.js';
import type { StoredFile } from '../../application/files/stored-file.js';
import type { UploadUrlOptions } from '../../application/files/upload-url-options.js';
import { ServedFileStorage } from '../../application/ports/served-file-storage.js';
import { SystemClock } from '../clock/system-clock.js';
import type { SignedLinkOptions } from './signed-link-options.js';
import { SignedFileTokens } from './signed-file-tokens.js';

/** The signed links of the storages the application serves itself: one token per link, under `baseUrl`. */
export abstract class SelfSignedFileStorage extends ServedFileStorage {
  private readonly tokens: SignedFileTokens;

  private readonly baseUrl: string;

  protected constructor(options: SignedLinkOptions) {
    super();

    this.tokens = new SignedFileTokens(
      options.secret ?? randomBytes(32).toString('hex'),
      options.clock ?? new SystemClock(),
    );

    this.baseUrl = (options.baseUrl ?? 'http://localhost:3000/files').replace(/\/+$/, '');
  }

  signedDownloadUrl(key: string, options: DownloadUrlOptions): Promise<SignedUrl> {
    const grant = { action: 'download' as const, key: assertFileKey(key) };
    const named = options.fileName === undefined ? grant : { ...grant, fileName: options.fileName };
    const { token, expiresAt } = this.tokens.sign(named, assertExpiry(options.expiresInSeconds));

    return Promise.resolve({ url: this.linkOf(token), expiresAt });
  }

  signedUploadUrl(key: string, options: UploadUrlOptions): Promise<SignedUpload> {
    const mediaType = mediaTypeOf(options.mediaType);
    const grant = { action: 'upload' as const, key: assertFileKey(key), mediaType };
    const { token, expiresAt } = this.tokens.sign(grant, assertExpiry(options.expiresInSeconds));

    return Promise.resolve({
      url: this.linkOf(token),
      method: 'PUT',
      headers: { 'content-type': mediaType },
      expiresAt,
    });
  }

  async openSigned(token: string): Promise<SignedDownload | undefined> {
    const grant = this.tokens.verify(token, 'download');
    const content = grant === undefined ? undefined : await this.get(grant.key);

    if (grant?.fileName === undefined || content === undefined) {
      return content;
    }

    return { ...content, fileName: grant.fileName };
  }

  async acceptSigned(token: string, content: FileSource, mediaType: string): Promise<StoredFile | undefined> {
    const grant = this.tokens.verify(token, 'upload');

    if (grant?.mediaType === undefined || grant.mediaType !== mediaTypeOf(mediaType)) {
      return undefined;
    }

    return this.put(grant.key, content, { mediaType: grant.mediaType });
  }

  /** The token travels in the query, where no router limits its length the way it limits a path parameter. */
  private linkOf(token: string): string {
    return `${this.baseUrl}?token=${token}`;
  }
}
