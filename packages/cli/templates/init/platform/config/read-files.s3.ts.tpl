import type { Environment } from '{{alias.platform}}/config/environment{{alias.ext}}';

/** The bucket that holds the content of files, on any provider of the S3 protocol. */
export interface FilesConfig {
  /** `S3_ENDPOINT`: empty for AWS; MinIO of the compose stack `http://localhost:9000`; OVHcloud, Scaleway or R2 their own. */
  readonly endpoint?: string;
  /** `S3_REGION`: `us-east-1` by default, `auto` for Cloudflare R2. */
  readonly region: string;
  /** `S3_BUCKET`: created by the infrastructure code of the deployment, by the compose stack in development. */
  readonly bucket: string;
  /** `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`: an access key allowed on this bucket only. */
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}

/** The settings of the S3 file storage. */
export function readFiles(env: Environment): FilesConfig {
  const endpoint = env.optionalUrl('S3_ENDPOINT', 'for AWS');

  return {
    ...(endpoint === undefined ? {} : { endpoint }),
    region: env.optional('S3_REGION') ?? 'us-east-1',
    bucket: env.text('S3_BUCKET'),
    accessKeyId: env.text('S3_ACCESS_KEY_ID'),
    secretAccessKey: env.text('S3_SECRET_ACCESS_KEY'),
  };
}
