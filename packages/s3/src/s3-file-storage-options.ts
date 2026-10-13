import type { S3Client } from '@aws-sdk/client-s3';
import type { Clock } from '@ddd-ts-kit/kernel';

export interface S3FileStorageOptions {
  /** `s3ClientOf(settings)` builds one for AWS, MinIO, OVHcloud, Scaleway or Cloudflare R2. */
  readonly client: S3Client;
  /** Created beforehand, by the infrastructure code of the deployment: the connector never creates one. */
  readonly bucket: string;
  /** Put before every key, ending with `/`: several applications or test runs then share a bucket. Default: none. */
  readonly prefix?: string;
  /** The size of each part of a multipart upload, at least 5 MiB, the most held in memory per upload. Default 8 MiB. */
  readonly partSize?: number;
  /** Reads the expiry the signed links answer. Default: the system clock. */
  readonly clock?: Clock;
}
