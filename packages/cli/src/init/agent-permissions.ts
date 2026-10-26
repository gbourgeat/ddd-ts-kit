import type { Config } from '../config';

export type AgentPermissions = Readonly<Record<'allow' | 'deny' | 'ask', readonly string[]>>;

/** What a permission rule names of the project: its stack decides where its migrations live. */
type Permitted = Pick<Config, 'stack'>;

/** Where the migrations of each ORM live, from the project root; none for a custom persistence or without one. */
const MIGRATIONS: Readonly<Record<string, string>> = {
  drizzle: 'migrations',
  knex: 'migrations',
  typeorm: 'migrations',
  prisma: 'prisma/migrations',
};

/**
 * What an agent may do in the project without asking, what it never does, and what it asks
 * for. Permissions only: nothing here changes how the agent behaves otherwise.
 */
export function agentPermissions(config: Permitted): AgentPermissions {
  return { allow: ALLOW, deny: DENY, ask: [...ASK, ...askedFiles(config)] };
}

const ALLOW: readonly string[] = [
  'Bash(npx ddd-ts-kit check *)',
  'Bash(npx ddd-ts-kit verify-slice *)',
  'Bash(npx ddd-ts-kit cited *)',
  'Bash(npx ddd-ts-kit acceptance *)',
  'Bash(npx ddd-ts-kit story *)',
  'Bash(npx ddd-ts-kit story-scope *)',
  'Bash(npx ddd-ts-kit stories)',
  'Bash(npx ddd-ts-kit stories *)',
  'Bash(npx ddd-ts-kit worktree *)',
  'Bash(npx ddd-ts-kit verify-merge)',
  'Bash(npx ddd-ts-kit verify-merge *)',
  'Bash(npx ddd-ts-kit story-check *)',
  'Bash(npx ddd-ts-kit merge-trunk)',
  'Bash(npx ddd-ts-kit merge-trunk *)',
  'Bash(npx ddd-ts-kit list *)',
  'Bash(npx ddd-ts-kit generate *)',
  'Bash(npx ddd-ts-kit docs *)',
  'Bash(npx ddd-ts-kit explain *)',
  'Bash(npx ddd-ts-kit rules)',
  'Bash(npm run verify)',
  'Bash(npm run typecheck)',
  'Bash(npm run lint *)',
  'Bash(npm test *)',
  'Bash(npm run test:e2e *)',
  'Bash(npm run regenerate)',
  'Bash(npm run docs:generate)',
  'Bash(npm run docs:check)',
  'Bash(npm run openapi:generate)',
  'Bash(npm run openapi:check)',
  'Bash(npm run events:generate)',
  'Bash(npm run events:check)',
];

// Secrets, then the generated contracts: those are regenerated, never edited, and the lock of
// an acceptance, which `ddd-ts-kit acceptance <story> --lock` alone writes. The secrets are
// named one by one: the sandbox of Claude Code masks every path a Read rule matches, and it
// ignores the negation of a `!` pattern, so a glob such as `.env.*` would also mask
// `.env.example` and break git. The compose file reads `.env` at the root, denied here;
// nothing under `docker/` holds a secret.
const DENY: readonly string[] = [
  'Read(./.env)',
  'Read(./.env.local)',
  'Read(./.env.*.local)',
  'Read(./.env.production)',
  'Read(./.env.development)',
  'Read(./.env.test)',
  'Edit(./openapi/**)',
  'Edit(./docs/integration/asyncapi.*)',
  'Edit(./docs/integration/event-catalog.md)',
  'Edit(./test/acceptance/*.acceptance.lock.json)',
];

// Then the files that hold the rules and the pipeline: changing one is a decision of the
// project owner, the same list as the editor hook of the plugin asks about. The review policy
// holds a rule of the project too.
const ASK: readonly string[] = [
  'Bash(git push *)',
  'Bash(npm publish *)',
  'Bash(npx ddd-ts-kit check --baseline write*)',
  'Edit(./ddd-ts-kit.config.json)',
  'Edit(./ddd-ts-kit-baseline.json)',
  'Edit(./REVIEW.md)',
  'Edit(./eslint.config.mjs)',
  'Edit(./biome.json)',
  'Edit(./.dependency-cruiser.cjs)',
  'Edit(./knip.json)',
  'Edit(./lefthook.yml)',
  'Edit(./.gitlab-ci.yml)',
  'Edit(./.github/workflows/**)',
  'Edit(./.claude/settings.json)',
  'Edit(./.github/copilot/settings.json)',
];

/**
 * Then what reaches production otherwise than through the code: a migration (the folder of the
 * ORM of the project) and the containers. An edit of one is asked, the weak form of the change
 * ticket a regulated team requires; the `change-reference` hook of the regulated profile is the strong one.
 */
function askedFiles({ stack }: Permitted): string[] {
  const migrations = MIGRATIONS[stack.orm];

  return [
    ...(migrations === undefined ? [] : [`Edit(./${migrations}/**)`]),
    'Edit(./Dockerfile)',
    'Edit(./docker-compose.yml)',
    'Edit(./docker/**)',
  ];
}
