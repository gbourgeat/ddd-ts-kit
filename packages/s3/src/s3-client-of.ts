import { S3Client } from '@aws-sdk/client-s3';
import type { S3Settings } from './s3-settings';

/**
 * A client for any provider of the S3 protocol. Checksums are computed only when an operation
 * requires one: the default of the SDK (a checksum on every request) is refused by several
 * providers that are not AWS, and would bind a signed upload link to an empty body.
 */
export function s3ClientOf(settings: S3Settings): S3Client {
  const { endpoint, region, accessKeyId, secretAccessKey } = settings;

  return new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
    ...(endpoint === undefined ? {} : { endpoint }),
    forcePathStyle: settings.forcePathStyle ?? endpoint !== undefined,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}
