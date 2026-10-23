import type { Environment } from '{{alias.platform}}/config/environment{{alias.ext}}';

/** Where the local storage keeps the content of files, and how a client reaches its signed links. */
export interface FilesConfig {
  /** `FILES_DIRECTORY`: a directory out of version control. Default `.data/files`. */
  readonly directory: string;
  /** `FILES_PUBLIC_URL`: where the routes that answer the signed links are reached. Required in production; elsewhere `http://localhost:<PORT>/files` by default. */
  readonly publicUrl: string;
  /** `FILES_SIGNING_SECRET`: signs the links, 32 characters at least. Required in production; left out elsewhere, one is drawn at each start. */
  readonly signingSecret?: string;
}

const SECRET_LENGTH = 32;

/** The settings of the local file storage, two of which production cannot leave to their defaults. */
export function readFiles(env: Environment, environment: string): FilesConfig {
  const production = environment === 'production';
  const signingSecret = env.optional('FILES_SIGNING_SECRET');

  if ((signingSecret ?? '').length < SECRET_LENGTH && (signingSecret !== undefined || production)) {
    env.problem('FILES_SIGNING_SECRET must hold 32 characters at least, and is required in production');
  }

  return {
    directory: env.optional('FILES_DIRECTORY') ?? '.data/files',
    publicUrl: publicUrlOf(env, production),
    ...(signingSecret === undefined ? {} : { signingSecret }),
  };
}

/** Left to its default in production, every signed link would point at localhost. */
function publicUrlOf(env: Environment, production: boolean): string {
  const given = env.optional('FILES_PUBLIC_URL');
  const publicUrl = given ?? `http://localhost:${env.optional('PORT') ?? '3000'}/files`;

  if (!URL.canParse(publicUrl) || (production && given === undefined)) {
    env.problem('FILES_PUBLIC_URL must be a URL, and is required in production');
  }

  return publicUrl;
}
