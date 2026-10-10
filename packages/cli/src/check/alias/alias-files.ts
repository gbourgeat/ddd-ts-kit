/** The files that say, each for its tool, how an alias is resolved. */
export const ALIAS_FILES = {
  manifest: 'package.json',
  typeCheck: 'tsconfig.json',
  build: 'tsconfig.build.json',
  deadCode: 'knip.json',
} as const;
