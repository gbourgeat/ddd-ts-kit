// The descriptions of the skills and agents stay short enough for the listing Claude Code loads
// into every session. Its documentation (https://code.claude.com/docs/en/skills.md, "Skill
// descriptions are cut short") caps each entry at 1,536 characters and says: "The budget scales
// at 1% of the model's context window. When the listing overflows, Claude Code drops descriptions
// starting with the skills you invoke least". The budget is in characters, not tokens (the
// setting that fixes it reads "Fraction of the context window (in characters) reserved for the
// skill listing", default 0.01), so on a 200k window it is 8,000 characters, and the listing is
// shared with every other skill of the session, those of Claude Code included. The six skills
// with `disable-model-invocation: true` are not listed ("Description not in context"); the 20
// others take about 5,600 characters with their `ddd-ts-kit:<name>`, about 70 percent of 8,000
// for the kit alone. A share that let them all survive next to other plugins (say 2,400
// characters) would cut them to less than half, past what a description needs to trigger on its
// keywords, so this is accepted: in a session that lists many skills, the least invoked of the
// kit lose their description and stop triggering on their keywords, and are still run by name.
// The test below holds the kit alone to the 8,000 characters, and the limits of 320 per skill and
// 6,500 in total stay. The agents' descriptions are listed the same way in the Agent tool, with
// no budget stated: 400 characters each. Run with `node --test`.
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
const LISTING_BUDGET = 8000;

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

test('the skills the model may invoke fit the 8,000 characters of the listing on their own', () => {
  const listed = skillDescriptions().filter(({ listed: isListed }) => isListed);
  const total = listed.reduce(
    (sum, { name, description }) => sum + `ddd-ts-kit:${name}`.length + description.length,
    0,
  );

  assert.ok(listed.length > 15, `too few listed skills read (${listed.length}): plugin/skills/ moved`);
  assert.ok(
    total <= LISTING_BUDGET,
    `the ${listed.length} listed skills take ${total} characters, over ${LISTING_BUDGET}`,
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
      listed: !disabled(path.join(SKILLS, entry.name, 'SKILL.md')),
    }));
}

function agentDescriptions() {
  return fs
    .readdirSync(AGENTS)
    .filter((file) => file.endsWith('.md'))
    .map((file) => ({ name: file.replace(/\.md$/, ''), description: descriptionOf(path.join(AGENTS, file)) }));
}

/** Whether the front matter sets `disable-model-invocation`, which keeps the skill out of the listing. */
function disabled(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const frontMatter = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(text)?.[1] ?? '';

  return YAML.parse(frontMatter)?.['disable-model-invocation'] === true;
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
