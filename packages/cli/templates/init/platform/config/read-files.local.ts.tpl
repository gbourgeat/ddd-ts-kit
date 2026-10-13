type Variables = Readonly<Record<string, string | undefined>>;

/** Where the local storage keeps the content of files, and how a client reaches its signed links. */
export interface FilesConfig {
  /** `FILES_DIRECTORY`: a directory out of version control. Default `.data/files`. */
  readonly directory: string;
  /** `FILES_PUBLIC_URL`: where the routes that answer the signed links are reached. Required in production; elsewhere `http://localhost:<PORT>/files` by default. */
  readonly publicUrl: string;
  /** `FILES_SIGNING_SECRET`: signs the links, 32 characters at least. Required in production; left out elsewhere, one is drawn at each start. */
  readonly signingSecret?: string;
}

/** The settings of the local file storage; a problem is reported by variable name only, never by value. */
export function readFiles(env: Variables, environment: string, problems: string[]): FilesConfig {
  const production = environment === 'production';
  const signingSecret = (env['FILES_SIGNING_SECRET'] ?? '').trim();

  if (signingSecret.length < 32 && (signingSecret !== '' || production)) {
    problems.push('FILES_SIGNING_SECRET must hold 32 characters at least, and is required in production');
  }

  return {
    directory: env['FILES_DIRECTORY'] ?? '.data/files',
    publicUrl: publicUrlOf(env, production, problems),
    ...(signingSecret === '' ? {} : { signingSecret }),
  };
}

/** Left to its default in production, every signed link would point at localhost. */
function publicUrlOf(env: Variables, production: boolean, problems: string[]): string {
  const given = env['FILES_PUBLIC_URL'];
  const publicUrl = given ?? `http://localhost:${env['PORT'] ?? '3000'}/files`;

  if (!URL.canParse(publicUrl) || (production && given === undefined)) {
    problems.push('FILES_PUBLIC_URL must be a URL, and is required in production');
  }

  return publicUrl;
}
