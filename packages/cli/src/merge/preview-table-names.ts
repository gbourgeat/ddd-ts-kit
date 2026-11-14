import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CONFIG_FILE, readConfig } from '../config';
import type { FileReader } from '../generate/kinds/same-name/sources-of';
import { Workspace } from '../workspace';
import { gitProcess } from './git-process';
import type { MergeContext } from './merge-context';
import type { Settled } from './merge-report';
import type { Resolution } from './resolution';
import { asSettled } from './as-settled';
import { tableNamesSettled } from './table-names-settled';
import { trunkReader } from './trunk-reader';

/** The merge a dry run computed: its tree, the trunk it merges, and how each conflicted path would be settled. */
interface Previewed {
  readonly tree: string;
  readonly trunk: string;
  readonly resolutions: readonly Resolution[];
}

/** The folder of a dry run, which holds the files the settle lists; any other file it reads comes from the tree of the merge. */
class TreeWorkspace extends Workspace {
  constructor(
    folder: string,
    private readonly inTree: FileReader,
  ) {
    super(folder, false);
  }

  override read(asked: string): string | undefined {
    return super.read(asked) ?? this.inTree(asked);
  }
}

/**
 * What the merge would settle in the schema index, said by a dry run that writes nothing: the
 * configuration, the index as the merge would leave it and the sources of the contexts are read
 * from the tree the merge computed, in a folder of their own that is removed, and the names are
 * settled there as the real run settles them: what it reads elsewhere comes from that tree too. What keeps it from saying, a
 * configuration the merge leaves conflicted for one, is said in its place.
 */
export function previewTableNames({ config, repo }: MergeContext, { tree, trunk, resolutions }: Previewed): Settled[] {
  if (config === undefined || !['drizzle', 'typeorm'].includes(config.stack.orm)) {
    return [];
  }

  const index = `${config.platformDir}/database/schema.ts`;
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'ddd-ts-kit-merge-'));
  const read = trunkReader(repo, tree);
  const settledIndex = resolutions.find(({ file }) => file === `${repo.prefix}${index}`)?.content;

  try {
    for (const file of [CONFIG_FILE, ...sourcesOfContexts(repo, { tree, contextsDir: config.contextsDir })]) {
      write(folder, file, read(file));
    }

    write(folder, index, settledIndex ?? read(index));

    const merged = readConfig(folder).config;

    const sides = { onTrunk: trunkReader(repo, trunk), onBranch: trunkReader(repo, 'HEAD') };

    return asSettled(tableNamesSettled(new TreeWorkspace(folder, read), merged, sides), {
      file: `${repo.prefix}${index}`,
      index,
    });
  } catch (error) {
    return [
      {
        file: `${repo.prefix}${index}`,
        kind: 'registry',
        how: `what the merge would settle in it could not be previewed (${String(error)})`,
      },
    ];
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

/** The sources of the contexts the tree holds, their specs left out, from the project root. */
function sourcesOfContexts(
  { top, prefix }: MergeContext['repo'],
  { tree, contextsDir }: { tree: string; contextsDir: string },
): string[] {
  const listed = gitProcess(top, ['ls-tree', '-r', '-z', '--name-only', tree, '--', `${prefix}${contextsDir}`]);

  return listed.stdout
    .split('\0')
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
    .map((file) => file.slice(prefix.length));
}

function write(folder: string, file: string, content: string | undefined): void {
  if (content !== undefined) {
    fs.mkdirSync(path.dirname(path.join(folder, file)), { recursive: true });
    fs.writeFileSync(path.join(folder, file), content);
  }
}
