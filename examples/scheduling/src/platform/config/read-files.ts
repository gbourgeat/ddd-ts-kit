type Variables = Readonly<Record<string, string | undefined>>;

/** Where the local storage keeps the content of files, and how a client reaches its signed links. */
export interface FilesConfig {
  /** `FILES_DIRECTORY`: a directory out of version control. Default `.data/files`. */
  readonly directory: string;
  /** `FILES_PUBLIC_URL`: where the routes that answer the signed links are reached. Default `http://localhost:<PORT>/files`. */
  readonly publicUrl: string;
  /** `FILES_SIGNING_SECRET`: signs the links, 32 characters at least. Required in production; left out elsewhere, one is drawn at each start. */
  readonly signingSecret?: string;
}

/** The settings of the local file storage; a problem is reported by variable name only, never by value. */
export function readFiles(env: Variables, environment: string, problems: string[]): FilesConfig {
  const publicUrl = env['FILES_PUBLIC_URL'] ?? `http://localhost:${env['PORT'] ?? '3000'}/files`;
  const signingSecret = (env['FILES_SIGNING_SECRET'] ?? '').trim();

  if (!URL.canParse(publicUrl)) {
    problems.push('FILES_PUBLIC_URL must be a URL');
  }

  if (signingSecret.length < 32 && (signingSecret !== '' || environment === 'production')) {
    problems.push('FILES_SIGNING_SECRET must hold 32 characters at least, and is required in production');
  }

  return {
    directory: env['FILES_DIRECTORY'] ?? '.data/files',
    publicUrl,
    ...(signingSecret === '' ? {} : { signingSecret }),
  };
}
