/**
 * What reaches production otherwise than through the code: the migrations of the ORM and the
 * containers. `paths` is the `GATED` list of the change-reference hook the regulated profile writes
 * (`packages/cli/templates/init/hooks/change-reference.mjs`): the hook asks for a change reference
 * before such a file is edited, `story-check` reads the `Change:` trailer of the commit that holds
 * it. The two lists change together. `pathspecs` are the same places for git, to list only the
 * commits that touch one of them.
 */
export const CHANGE_GATED = {
  paths: [/(^|\/)migrations\//, /^prisma\/migrations\//, /^docker\//, /^Dockerfile$/, /^docker-compose\.ya?ml$/],
  pathspecs: [
    ':(glob)migrations/**',
    ':(glob)**/migrations/**',
    ':(glob)prisma/migrations/**',
    ':(glob)docker/**',
    'Dockerfile',
    'docker-compose.yml',
    'docker-compose.yaml',
  ],
  /** True for a file the change-reference hook watches. */
  matches(file: string): boolean {
    return this.paths.some((pattern) => pattern.test(file));
  },
} as const;
