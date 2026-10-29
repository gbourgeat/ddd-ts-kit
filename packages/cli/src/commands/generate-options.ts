export const TEXT = { type: 'string' } as const;
const SWITCH = { type: 'boolean', default: false } as const;
const TEXTS = { type: 'string', multiple: true } as const;

/** The flags of `generate` every kind takes, whatever its usage shows: the `generate` line of the help states them. */
export const COMMON_FLAGS = ['allow-name', 'local-only', 'dry-run', 'force'] as const;

/** Every flag a kind may take; each kind reads the ones it knows, and refuses the others its usage does not show. */
export const GENERATE_OPTIONS = {
  ...Object.fromEntries(COMMON_FLAGS.map((flag) => [flag, SWITCH])),
  classification: TEXT,
  purpose: TEXT,
  preset: TEXT,
  upstream: TEXTS,
  term: TEXTS,
  value: TEXTS,
  transition: TEXTS,
  code: TEXT,
  aggregate: TEXT,
  method: TEXT,
  path: TEXT,
  command: SWITCH,
  query: SWITCH,
  version: TEXT,
  permission: TEXT,
  grant: TEXT,
  public: SWITCH,
  'tenant-scoped': SWITCH,
  personal: TEXT,
  subject: TEXT,
  erasure: TEXT,
  retention: TEXT,
  search: SWITCH,
  kind: TEXT,
  decorators: SWITCH,
  global: SWITCH,
  deviation: TEXT,
  phase: TEXT,
  event: TEXT,
  group: TEXT,
  prefix: TEXT,
  role: TEXT,
  mapper: SWITCH,
  serializer: SWITCH,
  cache: TEXT,
  module: TEXT,
  'event-sourced': SWITCH,
  creates: SWITCH,
  birth: TEXT,
  reason: TEXT,
  number: TEXT,
  name: TEXT,
  every: TEXT,
  cron: TEXT,
  'time-zone': TEXT,
};

/** How `generate` parses one flag. */
export type GenerateOption = typeof TEXT | typeof SWITCH | typeof TEXTS;
