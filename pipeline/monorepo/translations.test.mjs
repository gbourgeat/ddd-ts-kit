import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  addSwitchers,
  anchorsOf,
  check,
  contentHash,
  englishPages,
  githubSlug,
  inScope,
  stale,
  stamp,
  svgProblems,
} from './translations.mjs';

const RAW = 'https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/';
const DIAGRAM = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100" width="400">',
  '  <title id="title">Layers</title>',
  '  <desc>The layers of a context.</desc>',
  '  <rect width="400" height="100" rx="12" fill="#ffffff"/>',
  '  <text x="20" y="40" font-size="14">Domain</text>',
  '</svg>',
  '',
].join('\n');

/** A repository with the given files, in a temporary directory. */
function repository(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'translations-'));

  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  }

  return root;
}

function read(root, file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

/** A repository whose one page is translated and stamped. */
function translated(english, french, extra = {}) {
  const root = repository({ 'docs/guide.md': english, 'docs/guide.fr.md': french, ...extra });
  stamp(root, 'docs/guide.md');
  return root;
}

const ENGLISH = '**English** · [Français](guide.fr.md)\n\n# Guide\n\nRead [the other](other.md).\n';
const OTHER = '**English** · [Français](other.fr.md)\n\n# Other\n';

test('the scope leaves out French pages, changelogs, agent files, generated pages, tooling directories and the website', () => {
  for (const file of ['README.md', 'docs/concepts/aggregates.md', 'packages/kernel/README.md', 'examples/README.md']) {
    assert.equal(inScope(file), true, file);
  }

  for (const file of [
    'README.fr.md',
    'CHANGELOG.md',
    'packages/kernel/CHANGELOG.md',
    'CLAUDE.md',
    'AGENTS.md',
    'examples/scheduling/CLAUDE.md',
    'examples/scheduling/AGENTS.md',
    '.agents/plugins/marketplace.md',
    'examples/scheduling/src/contexts/identity/CONTEXT.md',
    'examples/scheduling/.claude/rules/domain.md',
    'examples/scheduling/.github/branch-protection.md',
    '.gitlab/note.md',
    'plugin/skills/start/SKILL.md',
    'pipeline/README.md',
    'packages/cli/templates/docs/event-catalog.md',
    'node_modules/x/README.md',
    'examples/scheduling/clients/api/README.md',
    'examples/scheduling/docs/integration/event-catalog.md',
    'site/src/content/docs/concepts/aggregates.md',
    'docs/notes.txt',
  ]) {
    assert.equal(inScope(file), false, file);
  }
});

test('lists the English pages in scope, without walking the skipped directories', () => {
  const root = repository({
    'README.md': 'x',
    'README.fr.md': 'x',
    'plugin/README.md': 'x',
    'node_modules/a/README.md': 'x',
    'docs/a.md': 'x',
  });

  assert.deepEqual(englishPages(root), ['README.md', 'docs/a.md']);
});

test('adds the switcher once, as the first line followed by a blank line', () => {
  const root = repository({
    'docs/guide.md': '# Guide\n',
    'README.md': '**English** · [Français](README.fr.md)\n\n# R\n',
  });

  assert.deepEqual(addSwitchers(root), ['docs/guide.md']);
  assert.equal(read(root, 'docs/guide.md'), '**English** · [Français](guide.fr.md)\n\n# Guide\n');
  assert.deepEqual(addSwitchers(root), []);
});

test('the hash leaves out the switcher, so adding it does not make a translation stale', () => {
  const bare = Buffer.from('# Guide\n');
  const switched = Buffer.from('**English** · [Français](guide.fr.md)\n# Guide\n');

  assert.equal(contentHash('docs/guide.md', switched), contentHash('docs/guide.md', bare));
  assert.match(contentHash('docs/guide.md', bare), /^[0-9a-f]{16}$/);
});

test('stamps the French page: switcher, translation-of line, blank line, then the translation', () => {
  const root = translated(ENGLISH, '# Guide\n\nLisez [l’autre](other.fr.md).\n');
  const lines = read(root, 'docs/guide.fr.md').split('\n');

  assert.equal(lines[0], '[English](guide.md) · **Français**');
  assert.match(lines[1] ?? '', /^<!-- translation-of: guide\.md sha256:[0-9a-f]{16} -->$/);
  assert.equal(lines[2], '');
  assert.equal(lines[3], '# Guide');

  stamp(root, 'docs/guide.md');
  assert.equal(read(root, 'docs/guide.fr.md').split('\n').length, lines.length);
  assert.throws(() => stamp(root, 'docs/other.md'), /does not exist/);
});

test('a complete translation has no problem; a changed English page makes it stale', () => {
  const root = translated(ENGLISH, '# Guide\n\nLisez [l’autre](other.fr.md).\n', {
    'docs/other.md': OTHER,
    'docs/other.fr.md': '# Autre\n',
  });
  stamp(root, 'docs/other.md');

  assert.deepEqual(check(root), []);

  fs.appendFileSync(path.join(root, 'docs/guide.md'), '\nA new paragraph.\n');
  assert.deepEqual(stale(root), ['docs/guide.fr.md']);
  assert.deepEqual(check(root), ['stale: docs/guide.fr.md translates an older docs/guide.md: update it, then --stamp']);
});

test('reports a page without switcher, a missing French page, and a French page never stamped', () => {
  const root = repository({
    'docs/a.md': '# A\n',
    'docs/b.md': '**English** · [Français](b.fr.md)\n\n# B\n',
    'docs/b.fr.md': '[English](b.md) · **Français**\n\n# B\n',
  });

  assert.deepEqual(check(root), [
    'docs/a.md:1: the first line is not the switcher "**English** · [Français](a.fr.md)": run --add-switchers',
    'docs/a.fr.md: missing: the French page of docs/a.md; write it, then --stamp docs/a.md',
    'docs/b.fr.md:2: the second line is not "<!-- translation-of: b.md sha256:<hash> -->": run --stamp docs/b.md',
  ]);
});

test('reports a link that leads nowhere, a missing anchor, and a French page that links to an English one', () => {
  const english =
    '**English** · [Français](guide.fr.md)\n\n# Guide\n\nSee [gone](gone.md), [top](#guide) and [other](other.md#other).\n';
  const french =
    '# Guide\n\nVoir [rien](gone.md), [haut](#guide-en-français), [autre](other.md).\n\n```md\n[code](ignored.md)\n```\n';
  const root = translated(english, french, { 'docs/other.md': OTHER, 'docs/other.fr.md': '# Autre\n' });
  stamp(root, 'docs/other.md');

  assert.deepEqual(check(root, ['docs/guide.md']), [
    'docs/guide.md:5: gone.md does not resolve to a file',
    'docs/guide.fr.md:6: gone.md does not resolve to a file',
    'docs/guide.fr.md:6: no heading of this page has the anchor #guide-en-français',
    'docs/guide.fr.md:6: links to the English page docs/other.md: link its French page docs/other.fr.md',
  ]);
});

test('the anchors are the slugs GitHub gives headings, accents kept and repeats numbered', () => {
  assert.equal(githubSlug('In an application of `@ddd-ts-kit/di`'), 'in-an-application-of-ddd-ts-kitdi');
  assert.equal(githubSlug('Événements du domaine : la boîte'), 'événements-du-domaine--la-boîte');
  assert.deepEqual([...anchorsOf('# Usage\n\n## Usage\n\n<a id="here"></a>\n')], ['usage', 'usage-1', 'here']);
});

test('a tag is removed from a heading once, and what it leaves is not read again as a tag', () => {
  assert.equal(githubSlug('Read <code>Clock</code> first'), 'read-clock-first');
  assert.equal(githubSlug('<scr<script>ipt>alert</script>'), 'iptalert');
  assert.equal(githubSlug('<scr<script>ipt'), 'ipt');
});

test('the French page shows the French drawing of each diagram, at the same place', () => {
  const english =
    '**English** · [Français](guide.fr.md)\n\n# Guide\n\n![The layers](assets/diagrams/guide-layers.svg)\n';
  const files = { 'docs/assets/diagrams/guide-layers.svg': DIAGRAM };
  const wrong = translated(english, '# Guide\n\n![Les couches](assets/diagrams/guide-layers.svg)\n', files);

  assert.deepEqual(check(wrong), [
    'docs/assets/diagrams/guide-layers.fr.svg: missing: the French drawing shown by docs/guide.fr.md',
    'docs/guide.fr.md: shows [docs/assets/diagrams/guide-layers.svg] where docs/guide.md shows [docs/assets/diagrams/guide-layers.svg]: show [docs/assets/diagrams/guide-layers.fr.svg], at the same places',
    'docs/assets/diagrams/guide-layers.svg: has no docs/assets/diagrams/guide-layers.fr.svg: every drawing exists in English and in French',
  ]);

  const right = translated(english, '# Guide\n\n![Les couches](assets/diagrams/guide-layers.fr.svg)\n', {
    ...files,
    'docs/assets/diagrams/guide-layers.fr.svg': DIAGRAM,
  });

  assert.deepEqual(check(right), []);
});

test('a page outside docs/ shows a diagram by the raw URL of the repository, which must exist', () => {
  const root = repository({
    'packages/kernel/README.md': `**English** · [Français](README.fr.md)\n\n![Layers](../../docs/assets/diagrams/a.svg)\n![Gone](${RAW}docs/assets/diagrams/gone.svg)\n`,
    'docs/assets/diagrams/a.svg': DIAGRAM,
    'docs/assets/diagrams/a.fr.svg': DIAGRAM,
  });

  assert.deepEqual(check(root, ['packages/kernel/README.md']).slice(0, 2), [
    `packages/kernel/README.md:3: a page outside docs/ shows a diagram by its absolute URL, so that npm renders it: ${RAW}docs/assets/diagrams/a.svg`,
    `packages/kernel/README.md:4: ${RAW}docs/assets/diagrams/gone.svg does not resolve to a file`,
  ]);
});

test('a diagram is self-contained, titled, readable and well formed', () => {
  assert.deepEqual(svgProblems(DIAGRAM), []);

  const broken = [
    '<?xml version="1.0"?>',
    '<svg width="1200"><script>alert(1)</script>',
    '<image href="https://example.com/a.png"/>',
    '<text font-size="10">a & b</text>',
    '<g></svg>',
  ].join('\n');

  assert.deepEqual(svgProblems(broken), [
    'does not start with <svg',
    'has no <title>',
    'has no <desc>',
    'holds a script',
    'embeds an image or a foreign object',
    'refers to https://example.com/a.png: no external reference',
    'has a text of 10px: at least 13',
    '</svg> closes a tag it did not open: not well formed',
  ]);
  assert.deepEqual(svgProblems(DIAGRAM.replace('viewBox="0 0 400 100" width="400"', 'width="1200"')), [
    'has no viewBox',
    'is 1200 wide: at most 960',
  ]);
});

test('a comment is removed once: a comment hidden inside another token leaves a stray <', () => {
  const withMarkup = (markup) => DIAGRAM.replace('</svg>', `${markup}\n</svg>`);

  assert.deepEqual(svgProblems(withMarkup('<!-- a <g> in a comment --><![CDATA[ a < b ]]><?note ?>')), []);
  assert.deepEqual(svgProblems(withMarkup('<!<!---->--')), ['holds a stray <: write &lt;']);
  assert.deepEqual(svgProblems(withMarkup('<!-- <!-- -->-->')), []);
  assert.deepEqual(svgProblems(withMarkup('<!-- never closed')), ['holds a stray <: write &lt;']);
});
