import { pipeline } from 'node:stream/promises';
import busboy, { type FileInfo } from 'busboy';
import { FileError, FileInspection, mediaTypeOf } from '@ddd-ts-kit/kernel';
import type { RawRequest } from '../pipeline/raw-request.js';
import type { ReceivedUpload } from '../pipeline/received-upload.js';
import type { UploadSpec } from '../route/upload-spec.js';
import { headerOf } from '../route/header-of.js';
import { missingFile } from './missing-file.js';
import type { MultipartLimits } from './multipart-limits.js';

/** Room for the boundaries, the part headers and the text fields over the declared size of the file. */
const ENVELOPE_BYTES = 1_048_576;

/**
 * Parses a `multipart/form-data` request as it streams and resolves as soon as the declared file
 * begins: the text fields read so far, and the file wrapped in a `FileInspection` that refuses it
 * beyond `maxBytes` or when its first bytes are not one of the accepted media types. A request
 * that announces a larger body is refused before any byte is read.
 */
export function readMultipart(spec: UploadSpec, request: RawRequest, limits: MultipartLimits): Promise<ReceivedUpload> {
  const contentType = headerOf(request.headers, 'content-type');

  if (mediaTypeOf(contentType) !== 'multipart/form-data') {
    return Promise.reject(FileError.unsupportedMediaType(mediaTypeOf(contentType), ['multipart/form-data']));
  }

  if (Number(headerOf(request.headers, 'content-length')) > spec.maxBytes + ENVELOPE_BYTES) {
    return Promise.reject(FileError.tooLarge(spec.maxBytes));
  }

  const { stream } = request;

  if (stream === undefined) {
    return Promise.reject(new Error('The adapter handed no request stream: an upload cannot be read.'));
  }

  return new Promise((resolve, reject) => {
    const parser = busboy({ headers: { 'content-type': contentType }, limits: limitsOf(spec, limits) });
    const fields: Record<string, string> = {};

    parser.on('field', (name: string, value: string) => {
      fields[name] = value;
    });

    parser.on('file', (name: string, file: NodeJS.ReadableStream, info: FileInfo) => {
      if (name !== spec.field) {
        file.resume();

        return;
      }

      resolve({ fields: { ...fields }, file: inspected(spec, file, info) });
    });

    parser.on('error', reject);

    parser.on('close', () => {
      reject(missingFile(spec.field));
    });

    stream.pipe(parser);
  });
}

function limitsOf(spec: UploadSpec, limits: MultipartLimits): busboy.Limits {
  return {
    files: 1,
    fileSize: spec.maxBytes + 1,
    fields: limits.fields ?? 20,
    fieldSize: limits.fieldBytes ?? 65_536,
  };
}

function inspected(spec: UploadSpec, file: NodeJS.ReadableStream, info: FileInfo): ReceivedUpload['file'] {
  const mediaType = mediaTypeOf(info.mimeType);

  const inspection = new FileInspection({
    maxBytes: spec.maxBytes,
    expected: { mediaType, accepted: spec.mediaTypes },
  });

  void pipeline(file, inspection).catch(() => undefined);

  return { fileName: info.filename ?? '', mediaType, stream: inspection };
}
