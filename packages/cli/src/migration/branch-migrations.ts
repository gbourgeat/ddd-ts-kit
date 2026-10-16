import { isRecord } from '../check/support/is-record.js';
import type { BranchMigration } from './branch-migration.js';

interface BranchFiles {
  /** The files of the migrations folder and of its `meta/`, by path. */
  readonly files: ReadonlyMap<string, string>;
  readonly folder: string;
  /** The tags of the branch's migrations, in their order. */
  readonly tags: readonly string[];
}

/**
 * The migrations of the branch with their SQL, each known as written by hand when its snapshot
 * repeats, ids aside, the snapshot it names as `prevId`: drizzle-kit copies the last snapshot for a
 * `--custom` migration, and writes the changed schema for any other.
 */
export function branchMigrations({ files, folder, tags }: BranchFiles): BranchMigration[] {
  const snapshots = new Map<string, string>();

  for (const [file, content] of files) {
    const snapshot =
      file.startsWith(`${folder}/meta/`) && file.endsWith('_snapshot.json') ? parsed(content) : undefined;

    if (isRecord(snapshot) && typeof snapshot['id'] === 'string') {
      snapshots.set(snapshot['id'], withoutIds(snapshot));
    }
  }

  return tags.map((tag) => {
    const own = parsed(files.get(`${folder}/meta/${tag.split('_')[0] ?? ''}_snapshot.json`));
    const parent = isRecord(own) && typeof own['prevId'] === 'string' ? snapshots.get(own['prevId']) : undefined;

    return {
      tag,
      sql: files.get(`${folder}/${tag}.sql`) ?? '',
      custom: isRecord(own) && parent !== undefined && withoutIds(own) === parent,
    };
  });
}

/** The snapshot without its own id and its parent's, keys sorted: what two snapshots of one schema share. */
function withoutIds(snapshot: Record<string, unknown>): string {
  const schema = Object.entries(snapshot).filter(([key]) => key !== 'id' && key !== 'prevId');

  return JSON.stringify(sorted(Object.fromEntries(schema)));
}

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sorted);
  }

  return isRecord(value)
    ? Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((key) => [key, sorted(value[key])]),
      )
    : value;
}

function parsed(text: string | undefined): unknown {
  try {
    return text === undefined ? undefined : JSON.parse(text);
  } catch {
    return undefined;
  }
}
