import { Arguments } from '../commands/arguments';
import { findKind } from './find-kind';
import type { Kind } from './kind';
import { KINDS } from './kinds';

const TEXT = { type: 'string' } as const;
const SWITCH = { type: 'boolean', default: false } as const;
const TEXTS = { type: 'string', multiple: true } as const;

/** Every flag a kind may take; each kind reads the ones it knows. */
const OPTIONS = {
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
  'allow-name': SWITCH,
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
  'dry-run': SWITCH,
  force: SWITCH,
  'local-only': SWITCH,
};

/** The arguments of `generate` as it reads them: the positionals wherever the flags stand, the value of each flag. */
export function generateArguments(argv: readonly string[]): Arguments {
  return Arguments.parse(argv, optionsOf(kindIn(argv)));
}

/**
 * The kind a command line asks for: its first word that is neither a flag nor the value of one
 * (`generate --module pricing job catalog Reprice` asks for a job). A flag that is a text for some
 * kinds only (`--command <UseCase>` of a job) takes the next word unless that word is a kind.
 */
function kindIn(argv: readonly string[]): Kind | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const word = argv[index] ?? '';

    if (!word.startsWith('-')) {
      return findKind(word);
    }

    const next = argv[index + 1] ?? '';

    if (!word.includes('=') && takesValue(word.replace(/^-+/, ''), next)) {
      index += 1;
    }
  }

  return undefined;
}

function takesValue(flag: string, next: string): boolean {
  const option = Object.entries(OPTIONS).find(([name]) => name === flag)?.[1];

  if (flag === 'cwd' || option?.type === 'string') {
    return true;
  }

  return KINDS.some((kind) => kind.textFlags?.includes(flag) === true) && findKind(next) === undefined;
}

/** One flag may be a switch for a kind and a text for another: `--command` of a route, `--command <UseCase>` of a job. */
function optionsOf(kind: Kind | undefined): Record<string, typeof TEXT | typeof SWITCH | typeof TEXTS> {
  return { ...OPTIONS, ...Object.fromEntries((kind?.textFlags ?? []).map((flag) => [flag, TEXT])) };
}
