type Variables = Readonly<Record<string, string | undefined>>;

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

/** The settings of the S3 file storage; a problem is reported by variable name only, never by value. */
export function readFiles(env: Variables, problems: string[]): FilesConfig {
  const endpoint = (env['S3_ENDPOINT'] ?? '').trim();
  const region = (env['S3_REGION'] ?? '').trim();

  if (endpoint !== '' && !URL.canParse(endpoint)) {
    problems.push('S3_ENDPOINT must be a URL, or empty for AWS');
  }

  return {
    ...(endpoint === '' ? {} : { endpoint }),
    region: region === '' ? 'us-east-1' : region,
    bucket: requiredText(env, 'S3_BUCKET', problems),
    accessKeyId: requiredText(env, 'S3_ACCESS_KEY_ID', problems),
    secretAccessKey: requiredText(env, 'S3_SECRET_ACCESS_KEY', problems),
  };
}

function requiredText(env: Variables, name: string, problems: string[]): string {
  const value = (env[name] ?? '').trim();

  if (value === '') {
    problems.push(name + ' must be set');
  }

  return value;
}
