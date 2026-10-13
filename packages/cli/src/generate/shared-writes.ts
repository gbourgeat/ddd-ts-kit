/** What a kind writes outside the context it is given. */
export interface SharedWrite {
  /** The shared files, each in a few words. */
  readonly files: readonly string[];
  /** The projects or the flags it happens with; without it, on every run. */
  readonly when?: string;
  /** How a worker confined to its context may still run the kind, when there is a way. */
  readonly worker?: string;
}

const STORAGE = ['the schema index of the platform (<platformDir>/database/schema.ts)', 'prisma/schema.prisma'];

const STORED =
  'the repository is the first of its context with drizzle, knex or typeorm (the tables file of the context joins the schema index), or stack.orm is prisma (every model joins the one schema)';

/** One entry per kind whose `writesShared` is true: `--local-only` refuses those writes, the conductor of a parallel build makes them on the trunk. */
export const SHARED_WRITES: Readonly<Record<string, SharedWrite>> = {
  context: {
    files: [
      'ddd-ts-kit.config.json',
      'the composition root (<platformDir>/compose-application.ts)',
      'test/architecture/extractable.spec.ts',
      'the permissions registry (<platformDir>/auth/permissions.ts)',
      'the CONTEXT.md of each upstream',
      'docs/context-map.md',
      '.dependency-cruiser.cjs',
      'knip.json (the first context)',
    ],
  },
  repository: { files: STORAGE, when: STORED },
  command: {
    files: STORAGE,
    when: `--aggregate names an aggregate without a repository, which is created with the command, and ${STORED}`,
    worker: 'on an aggregate that has its repository',
  },
  'integration-event': {
    files: ['the audited events registry (<platformDir>/audit/audited-events.ts)', 'docs/context-map.md'],
    when: 'the audit trail is wired, or the event type is new',
  },
  adapter: {
    files: ['<platformDir>/resilience/own-policy.ts'],
    when: 'the adapter is the first of a project wired on tsyringe to state its own policy (the helper joins the platform)',
    worker: 'once the project has its first adapter',
  },
  'route-group': {
    files: ['the role vocabulary of the platform (<platformDir>/auth/role.ts)'],
    when: '--role names a role the vocabulary does not hold yet',
    worker: 'without --role, or with a role the vocabulary already holds',
  },
  job: { files: ['<platformDir>/job-settings.ts', 'the grant of its system actor (<platformDir>/auth/)'] },
  policy: {
    files: ['the access policies registry (<platformDir>/auth/access-policies.ts)'],
    when: 'stack.style is explicit',
  },
  gateway: {
    files: [
      'the read contract and the index of the published language of the upstream',
      '<platformDir>/platform.module.ts and platform-test.module.ts (declared style)',
    ],
  },
  service: {
    files: [
      '<sourceRoot>/apps/<context>/main.ts',
      'package.json',
      'knip.json',
      'ddd-ts-kit.config.json',
      'docker-compose.yml',
      'docs/context-map.md',
    ],
  },
  worker: {
    files: [
      '<sourceRoot>/apps/worker/main.ts',
      'package.json',
      'ddd-ts-kit.config.json',
      'docker-compose.yml',
      '<platformDir>/config/load-config.ts',
    ],
  },
  adr: { files: ['docs/adr/', 'ddd-ts-kit.config.json (with --deviation)'] },
};
