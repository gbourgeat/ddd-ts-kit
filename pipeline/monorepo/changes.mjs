#!/usr/bin/env node
// What a version changes for a user is written by each pull request in a file of its own under
// changes/, never in CHANGELOG.md: two pull requests then never write the same line, and a merge
// of one leaves the others mergeable as they are. The release folds the files into CHANGELOG.md.
//
//   node pipeline/monorepo/changes.mjs --check --base <git-ref>   what a pull request has to hold
//
// `foldChanges` is called by `release-version.mjs --set`.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const CHANGES = 'changes';
const README = 'README.md';
const PLUGIN_MANIFEST = 'plugin/.claude-plugin/plugin.json';
/** A release states its version here: a pull request that changes it is the release. */
const RELEASE_MARK = 'packages/cli/src/version.ts';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}

function main(args) {
  const at = args.indexOf('--base');
  const base = at === -1 ? undefined : args[at + 1];

  if (!args.includes('--check') || base === undefined || base === '') {
    console.error('Usage: changes.mjs --check --base <git-ref>');

    return 2;
  }

  const problems = problemsOf(changedSince(base), {
    read: (file) => fs.readFileSync(path.join(ROOT, file), 'utf8'),
    readAtBase: (file) => {
      const show = spawnSync('git', ['show', `${base}:${file}`], { cwd: ROOT, encoding: 'utf8' });

      return show.status === 0 ? show.stdout : undefined;
    },
  });

  for (const problem of problems) {
    console.error(problem);
  }

  return problems.length === 0 ? 0 : 1;
}

function changedSince(base) {
  const diff = spawnSync('git', ['diff', '--name-only', '--no-renames', '--diff-filter=d', '-z', base, 'HEAD'], {
    cwd: ROOT,
    encoding: 'utf8',
  });

  if (diff.status !== 0) {
    throw new Error(`git cannot tell what changed since ${base}: ${diff.stderr}`);
  }

  return diff.stdout.split('\0').filter(Boolean);
}

/**
 * What keeps a pull request off the shared lines: CHANGELOG.md and the version of the plugin are
 * written by the release only, a change of the plugin says what it changes in a file of changes/,
 * and that file opens with its bold summary.
 */
export function problemsOf(changed, { read, readAtBase }) {
  const release = changed.includes(RELEASE_MARK);
  const fragments = changed.filter(isFragment);
  const problems = [];

  if (!release && changed.includes('CHANGELOG.md')) {
    problems.push(
      'CHANGELOG.md is written by the release: say what this change does for a user in a file of its own, changes/<what-it-does>.md (changes/README.md).',
    );
  }

  if (
    !release &&
    changed.includes(PLUGIN_MANIFEST) &&
    versionOf(read(PLUGIN_MANIFEST)) !== versionOf(readAtBase(PLUGIN_MANIFEST))
  ) {
    problems.push(
      `The version of the plugin is the version of the kit, set by the release: leave ${PLUGIN_MANIFEST} as it is, and say what the plugin gains in changes/<what-it-does>.md.`,
    );
  }

  if (
    !release &&
    changed.some((file) => file.startsWith('plugin/') && file !== PLUGIN_MANIFEST) &&
    fragments.length === 0
  ) {
    problems.push(
      'This change reaches the plugin: say what it changes for a user in changes/<what-it-does>.md, which the release folds into CHANGELOG.md; the plugin ships under the version of that release.',
    );
  }

  for (const fragment of fragments) {
    if (!read(fragment).trimStart().startsWith('**')) {
      problems.push(
        `${fragment} opens with its summary in bold, as an entry of CHANGELOG.md does: **What changes.** Then the detail.`,
      );
    }
  }

  return problems;
}

/** Only the version tells a release from another edit of the manifest (its description, its keywords). */
function versionOf(manifest) {
  return manifest === undefined ? undefined : JSON.parse(manifest).version;
}

function isFragment(file) {
  return file.startsWith(`${CHANGES}/`) && file.endsWith('.md') && file !== `${CHANGES}/${README}`;
}

/**
 * The files of changes/ become the section of `version` at the top of CHANGELOG.md, in the order
 * they reached the trunk (the commit that added each one), and are deleted. What a section
 * `## Unreleased` holds, written before this folder existed, comes first. Answers how many it folded.
 */
export function foldChanges(root, version) {
  const directory = path.join(root, CHANGES);
  const files = fs.existsSync(directory)
    ? fs
        .readdirSync(directory)
        .filter((name) => name.endsWith('.md') && name !== README)
        .map((name) => `${CHANGES}/${name}`)
    : [];

  const entries = files
    .map((file) => ({ file, added: addedAt(root, file), text: fs.readFileSync(path.join(root, file), 'utf8').trim() }))
    .sort((left, right) => left.added - right.added || left.file.localeCompare(right.file));

  const changelog = path.join(root, 'CHANGELOG.md');
  const { head, unreleased, released } = sectionsOf(fs.readFileSync(changelog, 'utf8'));
  const body = [...unreleased, ...entries.map((entry) => entry.text)];

  if (body.length > 0) {
    fs.writeFileSync(changelog, `${[head, `## ${version}`, ...body, released].join('\n\n').trimEnd()}\n`);
  }

  for (const { file } of entries) {
    fs.rmSync(path.join(root, file));
  }

  return entries.length;
}

/** When the commit that added the file was committed, the squash merge of its pull request on the trunk; last for a file not committed yet. */
function addedAt(root, file) {
  const log = spawnSync('git', ['log', '--diff-filter=A', '--format=%ct', '-1', '--', file], {
    cwd: root,
    encoding: 'utf8',
  });
  const seconds = Number.parseInt(log.stdout.trim(), 10);

  return Number.isNaN(seconds) ? Number.MAX_SAFE_INTEGER : seconds;
}

/** The introduction, the entries of a section `## Unreleased` if there is one, and the released versions from the first `## <version>` on. */
function sectionsOf(text) {
  const first = text.search(/^## /m);
  const head = (first === -1 ? text : text.slice(0, first)).trimEnd();
  const rest = first === -1 ? '' : text.slice(first);

  if (!rest.startsWith('## Unreleased')) {
    return { head, unreleased: [], released: rest.trimEnd() };
  }

  const next = rest.slice('## Unreleased'.length).search(/^## /m);
  const section = next === -1 ? rest : rest.slice(0, next + '## Unreleased'.length);
  const released = next === -1 ? '' : rest.slice(next + '## Unreleased'.length);
  const unreleased = section.slice('## Unreleased'.length).trim();

  return { head, unreleased: unreleased === '' ? [] : [unreleased], released: released.trimEnd() };
}
