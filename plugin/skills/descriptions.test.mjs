// The descriptions of the skills and agents stay short enough for the listing Claude Code loads
// into every session. Its documentation (https://code.claude.com/docs/en/skills.md, "Skill
// descriptions are cut short") says: "The budget scales at 1% of the model's context window.
// When the listing overflows, Claude Code drops descriptions starting with the skills you invoke
// least", and caps each entry at 1,536 characters. On a 200k window that budget is about 2,000
// tokens, roughly 8,000 characters: past it, the least-invoked skills of the kit lose their
// description and stop triggering on their keywords. The agents' descriptions are listed the same
// way in the Agent tool. So each description holds its trigger and the words a user says, at most
// 400 characters, and the 26 skills at most 8,000 together. Run with `node --test`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SKILLS = path.join(ROOT, 'plugin/skills');
const AGENTS = path.join(ROOT, 'plugin/agents');
const MAX_ONE = 400;
const MAX_SKILLS = 8000;

test('every skill description is at most 400 characters', () => {
  assert.deepEqual(tooLong(skillDescriptions()), [], `skill descriptions over ${MAX_ONE} characters`);
});

test('the skill descriptions total at most 8,000 characters', () => {
  const descriptions = skillDescriptions();
  const total = descriptions.reduce((sum, { description }) => sum + description.length, 0);
  const longest = [...descriptions]
    .sort((a, b) => b.description.length - a.description.length)
    .slice(0, 5)
    .map(({ name, description }) => `${name} (${description.length})`);

  assert.ok(descriptions.length > 20, `too few skills read (${descriptions.length}): plugin/skills/ moved`);
  assert.ok(
    total <= MAX_SKILLS,
    `the ${descriptions.length} skill descriptions take ${total} characters, over ${MAX_SKILLS}; longest: ${longest.join(', ')}`,
  );
});

test('every agent description is at most 400 characters', () => {
  const descriptions = agentDescriptions();

  assert.ok(descriptions.length > 0, 'no agent read: plugin/agents/ moved');
  assert.deepEqual(tooLong(descriptions), [], `agent descriptions over ${MAX_ONE} characters`);
});

/** The name and length of each description over the limit. */
function tooLong(descriptions) {
  return descriptions
    .filter(({ description }) => description.length > MAX_ONE)
    .map(({ name, description }) => `${name} (${description.length})`);
}

function skillDescriptions() {
  return fs
    .readdirSync(SKILLS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      description: descriptionOf(path.join(SKILLS, entry.name, 'SKILL.md')),
    }));
}

function agentDescriptions() {
  return fs
    .readdirSync(AGENTS)
    .filter((file) => file.endsWith('.md'))
    .map((file) => ({ name: file.replace(/\.md$/, ''), description: descriptionOf(path.join(AGENTS, file)) }));
}

/**
 * The `description` of the front matter as YAML reads it: a folded block (`>-` or `>`, its lines
 * joined by spaces) or a scalar on one line, quoted or not.
 */
function descriptionOf(file) {
  const text = fs.readFileSync(file, 'utf8');
  const frontMatter = /^---\n([\s\S]*?)\n---/.exec(text)?.[1];

  assert.ok(frontMatter !== undefined, `${file} has no front matter`);

  const lines = frontMatter.split('\n');
  const at = lines.findIndex((line) => line.startsWith('description:'));

  assert.notEqual(at, -1, `${file} has no description`);

  const value = lines[at].slice('description:'.length).trim();

  if (value === '>-' || value === '>') {
    const block = [];

    for (const line of lines.slice(at + 1)) {
      if (!/^\s+\S/.test(line)) {
        break;
      }

      block.push(line.trim());
    }

    return block.join(' ');
  }

  assert.ok(!['|', '|-'].includes(value), `${file}: write the description folded (>-) or on one line`);

  return /^(["']).*\1$/.test(value) ? value.slice(1, -1) : value;
}
