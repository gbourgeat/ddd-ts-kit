/** What reaches a bucket: the same five values for every provider of the S3 protocol. */
export interface S3Settings {
  /** Left out for AWS. MinIO `http://localhost:9000`, OVHcloud `https://s3.gra.io.cloud.ovh.net`, R2 `https://<account>.r2.cloudflarestorage.com`. */
  readonly endpoint?: string;
  /** `auto` for R2; the region of the bucket elsewhere. */
  readonly region: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  /** `bucket` in the path instead of the host name: MinIO and most self-hosted servers need it. Default: true with an endpoint. */
  readonly forcePathStyle?: boolean;
}
