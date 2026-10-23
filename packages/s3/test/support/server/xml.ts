import type { CompletedPart, ObjectPage, PendingUpload, StoredObject } from './shapes';

const NAMESPACE = 'http://s3.amazonaws.com/doc/2006-03-01/';
const DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>\n';

/** The documents the server answers, shaped as MinIO shapes them, which the SDK reads. */
export const xml = {
  error(code: string, message: string, resource: string, key: string): string {
    const keyElement = key === '' ? '' : element('Key', key);

    return `${DECLARATION}<Error>${element('Code', code)}${element('Message', message)}${keyElement}${element('Resource', resource)}${element('RequestId', 'in-memory')}</Error>`;
  },

  copied(object: StoredObject): string {
    return document(
      'CopyObjectResult',
      element('LastModified', object.lastModified.toISOString()) + element('ETag', object.etag),
    );
  },

  initiated(bucket: string, key: string, uploadId: string): string {
    return document(
      'InitiateMultipartUploadResult',
      element('Bucket', bucket) + element('Key', key) + element('UploadId', uploadId),
    );
  },

  completed(bucket: string, key: string, object: StoredObject): string {
    return document(
      'CompleteMultipartUploadResult',
      element('Bucket', bucket) + element('Key', key) + element('ETag', object.etag),
    );
  },

  listed(page: ObjectPage): string {
    const contents = page.objects
      .map(
        ([key, object]) =>
          `<Contents>${element('Key', key)}${element('LastModified', object.lastModified.toISOString())}${element('ETag', object.etag)}${element('Size', String(object.body.length))}${element('StorageClass', 'STANDARD')}</Contents>`,
      )
      .join('');

    const next = page.nextToken === undefined ? '' : element('NextContinuationToken', page.nextToken);
    const token = page.token === undefined ? '' : element('ContinuationToken', page.token);

    return document(
      'ListBucketResult',
      `${element('Name', page.bucket)}${element('Prefix', page.prefix)}${token}${element('KeyCount', String(page.objects.length))}${element('MaxKeys', String(page.maxKeys))}${element('IsTruncated', String(page.nextToken !== undefined))}${next}${contents}`,
    );
  },

  uploads(bucket: string, prefix: string, uploads: readonly PendingUpload[]): string {
    const listed = uploads
      .map((upload) => `<Upload>${element('Key', upload.key)}${element('UploadId', upload.id)}</Upload>`)
      .join('');

    return document(
      'ListMultipartUploadsResult',
      `${element('Bucket', bucket)}${element('Prefix', prefix)}${element('MaxUploads', '10000')}${element('IsTruncated', 'false')}${listed}`,
    );
  },

  /** The parts a `CompleteMultipartUpload` names, in the order it names them. */
  partsOf(body: string): readonly CompletedPart[] {
    return [...body.matchAll(/<Part>([\s\S]*?)<\/Part>/g)].map(([, part = '']) => ({
      number: Number(/<PartNumber>(\d+)<\/PartNumber>/.exec(part)?.[1]),
      etag: unescape(/<ETag>([^<]*)<\/ETag>/.exec(part)?.[1] ?? ''),
    }));
  },
};

function document(name: string, content: string): string {
  return `${DECLARATION}<${name} xmlns="${NAMESPACE}">${content}</${name}>`;
}

function element(name: string, text: string): string {
  return `<${name}>${escape(text)}</${name}>`;
}

function escape(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&#34;')
    .replaceAll("'", '&#39;');
}

function unescape(text: string): string {
  return text
    .replaceAll('&#34;', '"')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}
