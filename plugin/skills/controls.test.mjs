// The table "What holds each skill" of docs/guides/coding-agents.md names, for each skill of the
// plugin, the deterministic control behind it: rule ids, gates of the guard, checks of the
// pipeline. It is the source of that fact, so it cannot drift: every skill directory has a row,
// and every rule id the table names is one the CLI knows (`rules --json` of the built CLI, else the
// literals of the checker sources: CONTROLS_FROM_SOURCE=1 forces the latter). Run with `node --test`.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '../..');
const GUIDE = path.join(ROOT, 'docs/guides/coding-agents.md');
const SKILLS = path.join(ROOT, 'plugin/skills');
const BUILT_CLI = path.join(ROOT, 'packages/cli/dist/bin.js');
const CHECK_SOURCES = path.join(ROOT, 'packages/cli/src/check');
const HEADING = '## What holds each skill';

/** A rule id as `ddd-ts-kit rules` prints it, and a family written `authz/*`. */
const RULE_ID = /^[a-z][a-z-]*\/[a-z][a-z-]*$/;
const FAMILY = /^([a-z][a-z-]*)\/\*$/;
const ID_LITERAL = /'([a-z][a-z-]*\/[a-z][a-z-]*)'/g;

test('every skill of the plugin has a row in the table of the guide', () => {
  const skills = fs
    .readdirSync(SKILLS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const rows = tableRows();
  const named = new Set(rows.map((row) => row.skill));

  assert.ok(rows.length > 0, 'the table holds no row');
  assert.deepEqual(
    skills.filter((skill) => !named.has(skill)),
    [],
    'skills without a row in "What holds each skill" of docs/guides/coding-agents.md',
  );
  assert.deepEqual(
    [...named].filter((skill) => skill !== undefined && !skills.includes(skill)),
    [],
    'rows of the table that name no skill of plugin/skills/',
  );
});

/** The rows of the table under the heading: the skill of the first cell and the backticked words of the row. */
function tableRows() {
  const page = fs.readFileSync(GUIDE, 'utf8');
  const start = page.indexOf(HEADING);

  assert.notEqual(start, -1, `${GUIDE} has no "${HEADING}" section`);

  const section = page.slice(start + HEADING.length);
  const end = section.search(/^## /m);
  const lines = (end === -1 ? section : section.slice(0, end)).split('\n');

  return lines
    .filter((line) => line.startsWith('| `'))
    .map((line) => {
      const cells = line.split('|').map((cell) => cell.trim());
      const skill = /^`([a-z-]+)`$/.exec(cells[1] ?? '')?.[1];

      return { skill, words: [...line.matchAll(/`([^`]+)`/g)].map((match) => match[1]) };
    });
}

test('every rule id the table names is one the CLI knows', () => {
  const known = knownRuleIds();

  assert.ok(known.size > 50, `too few rule ids read (${known.size}): the checker sources or the built CLI moved`);

  const unknown = [];

  for (const { skill, words } of tableRows()) {
    for (const word of words) {
      const family = FAMILY.exec(word)?.[1];

      if (family !== undefined && ![...known].some((id) => id.startsWith(`${family}/`))) {
        unknown.push(`${skill}: ${word}`);
      } else if (RULE_ID.test(word) && !known.has(word) && !looksLikeAPath(word)) {
        unknown.push(`${skill}: ${word}`);
      }
    }
  }

  assert.deepEqual(unknown, [], 'rule ids of the table unknown to `ddd-ts-kit rules`');
});

/**
 * The rule ids the CLI knows: `rules --json` of the built CLI when it exists, else the ids written
 * as literals in the sources of the checker, which need no build and no network.
 */
function knownRuleIds() {
  if (fs.existsSync(BUILT_CLI) && process.env['CONTROLS_FROM_SOURCE'] === undefined) {
    const run = spawnSync(process.execPath, [BUILT_CLI, 'rules', '--json'], { cwd: ROOT, encoding: 'utf8' });

    assert.equal(run.status, 0, `rules --json failed: ${run.stderr}`);

    const listed = JSON.parse(run.stdout);
    const rules = Array.isArray(listed) ? listed : (listed.rules ?? []);

    return new Set(rules.map((rule) => (typeof rule === 'string' ? rule : rule.id)));
  }

  const ids = new Set();

  for (const file of filesUnder(CHECK_SOURCES)) {
    for (const [, id] of fs.readFileSync(file, 'utf8').matchAll(ID_LITERAL)) {
      ids.add(id);
    }
  }

  return ids;
}

function filesUnder(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return filesUnder(file);
    }

    return entry.isFile() && file.endsWith('.ts') ? [file] : [];
  });
}

/** A word written like a rule id that is a path of the project (`docs/architecture`, `test/acceptance`): not a rule. */
function looksLikeAPath(word) {
  return fs.existsSync(path.join(ROOT, word)) || fs.existsSync(path.join(ROOT, 'examples/scheduling', word));
}
