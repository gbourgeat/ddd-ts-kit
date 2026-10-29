// The descriptions of the skills and agents stay short enough for the listing Claude Code loads
// into every session. Its documentation (https://code.claude.com/docs/en/skills.md, "Skill
// descriptions are cut short") says: "The budget scales at 1% of the model's context window.
// When the listing overflows, Claude Code drops descriptions starting with the skills you invoke
// least", and caps each entry at 1,536 characters. On a 200k window that budget is about 2,000
// tokens. The listing holds more than the descriptions: each entry carries `ddd-ts-kit:<name>`
// and its formatting, about 660 characters for the 26 skills, and this technical text (`authz/*`,
// `it.todo`, `/ddd-ts-kit:story`) runs at about 3.5 characters per token, not 4. So 6,500
// characters of descriptions are about (6,500 + 660) / 3.5 = 2,050 tokens if all 26 were listed;
// the six skills with `disable-model-invocation: true` are not ("Description not in context"),
// which leaves the 20 others at about 5,000 + 550 characters, some 1,600 tokens, under the budget
// with room for another plugin. Past it, the least-invoked skills lose their description and stop
// triggering on their keywords. The agents' descriptions are listed the same way in the Agent
// tool, with no budget stated: 400 characters each. Run with `node --test`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import YAML from 'yaml';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SKILLS = path.join(ROOT, 'plugin/skills');
const AGENTS = path.join(ROOT, 'plugin/agents');
const MAX_SKILL = 320;
const MAX_AGENT = 400;
const MAX_SKILLS = 6500;

test('every skill description is at most 320 characters', () => {
  assert.deepEqual(tooLong(skillDescriptions(), MAX_SKILL), [], `skill descriptions over ${MAX_SKILL} characters`);
});

test('the skill descriptions total at most 6,500 characters', () => {
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
  assert.deepEqual(tooLong(descriptions, MAX_AGENT), [], `agent descriptions over ${MAX_AGENT} characters`);
});

/** The name and length of each description over the limit. */
function tooLong(descriptions, limit) {
  return descriptions
    .filter(({ description }) => description.length > limit)
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

/** The `description` of the front matter, as YAML reads it, whatever the line endings of the checkout. */
function descriptionOf(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const frontMatter = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(text)?.[1];

  assert.ok(frontMatter !== undefined, `${file} does not open with a front matter between two --- lines`);

  const description = YAML.parse(frontMatter)?.description;

  assert.equal(typeof description, 'string', `${file} has no description in its front matter`);

  return description;
}
