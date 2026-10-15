import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  assemble,
  descriptionOf,
  mermaidBlocks,
  plainText,
  rewriteLinks,
  sitePages,
  splitTitle,
  withoutBanner,
  withoutHead,
} from './assemble.mjs';
import { builtProblems } from './check-built.mjs';
import { pitchOf } from './home.mjs';
import { sidebar, sidebarRoutes } from './navigation.mjs';
import { hrefOf, routeOf } from './routes.mjs';

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '../..');
const BLOB = 'https://github.com/gbourgeat/ddd-ts-kit/blob/main/';
const RAW = 'https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/';

/** A repository with the given files, in a temporary directory. */
function repository(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'site-'));

  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  }

  return root;
}

/** An English page and its French page, with their switchers: `[title, body]` for each. */
function pair(english, [title, body], [frenchTitle, frenchBody]) {
  const name = path.posix.basename(english, '.md');

  return {
    [english]: `**English** · [Français](${name}.fr.md)\n\n# ${title}\n\n${body}\n`,
    [english.replace(/\.md$/, '.fr.md')]:
      `[English](${name}.md) · **Français**\n<!-- translation-of: ${name}.md sha256:0123456789abcdef -->\n\n# ${frenchTitle}\n\n${frenchBody}\n`,
  };
}

const SMALL = {
  ...pair(
    'README.md',
    [
      'ddd-ts-kit',
      `The pitch, on\ntwo lines.\n\n![The nine steps](${RAW}docs/assets/diagrams/ddd-ts-kit-workflow.svg)`,
    ],
    ['ddd-ts-kit', `Le pitch.\n\n![Les neuf étapes](${RAW}docs/assets/diagrams/ddd-ts-kit-workflow.fr.svg)`],
  ),
  ...pair(
    'docs/concepts/aggregates.md',
    [
      'Aggregates',
      '**Summary.** An aggregate is a boundary.\n\nSee [the outbox](transactional-outbox.md#the-relay), [the top](#aggregates), [the code](../../packages/kernel/src/index.ts) and [the packages](../../packages/kernel).\n\n## Rules\n\n```ts\nconst link = "[x](nowhere.md)";\n```\n\n```mermaid\nflowchart LR\n  A["a<br/>b"] --> B\n```',
    ],
    ['Agrégats', "Voir [la boîte d'envoi](transactional-outbox.fr.md#le-relais) et `[x](nowhere.md)`."],
  ),
  ...pair(
    'docs/concepts/transactional-outbox.md',
    ['Transactional outbox', '## The relay\n\nText.'],
    ['Outbox transactionnelle', '## Le relais\n\nTexte.'],
  ),
  ...pair('packages/kernel/README.md', ['@ddd-ts-kit/kernel', 'The kernel.'], ['@ddd-ts-kit/kernel', 'Le noyau.']),
  'packages/kernel/src/index.ts': 'export {};\n',
  'docs/assets/diagrams/ddd-ts-kit-workflow.svg': '<svg/>',
  'docs/assets/diagrams/ddd-ts-kit-workflow.fr.svg': '<svg/>',
  'CHANGELOG.md': '# Changelog\n',
};

/** The body of a page of SMALL (or `body` in its place), its links rewritten for the site. */
function rewritten(source, body = withoutHead(SMALL[source])) {
  const root = repository(SMALL);

  return rewriteLinks({ root, pages: sitePages(root) }, sitePages(root).get(source), body);
}

test('each kind of page has its route, a README being the page of its directory', () => {
  const routes = {
    'README.md': 'start',
    'CONTRIBUTING.md': 'contributing',
    'CODE_OF_CONDUCT.md': 'contributing/code-of-conduct',
    'docs/README.md': 'documentation',
    'docs/ARCHITECTURE.md': 'architecture',
    'docs/translation.md': 'contributing/translation',
    'docs/concepts/README.md': 'concepts',
    'docs/concepts/aggregates.md': 'concepts/aggregates',
    'docs/tools/persistence.md': 'tools/persistence',
    'packages/kernel/README.md': 'packages/kernel',
    'packages/rabbitmq/docs/other-brokers.md': 'packages/rabbitmq/other-brokers',
    'packages/eslint-plugin/docs/rules/clean-stepdown.md': 'rules/clean-stepdown',
    'examples/README.md': 'example',
    'examples/scheduling/README.md': 'example/scheduling',
    'examples/scheduling/docs/adr/0001-x.md': 'example/scheduling/adr/0001-x',
    'examples/scheduling/docs/architecture/briefings/README.md': 'example/scheduling/architecture/briefings',
  };

  for (const [page, route] of Object.entries(routes)) {
    assert.equal(routeOf(page), route, page);
  }

  assert.equal(routeOf('notes/idea.md'), undefined);
  assert.equal(hrefOf('concepts/aggregates', 'fr'), '/ddd-ts-kit/fr/concepts/aggregates/');
  assert.equal(hrefOf('', 'en'), '/ddd-ts-kit/');
});

test('the switcher and the translation-of line are dropped, and the first heading becomes the title', () => {
  const french =
    '[English](x.md) · **Français**\n<!-- translation-of: x.md sha256:0123456789abcdef -->\n\n# Titre\n\nCorps.\n';

  assert.equal(withoutHead('**English** · [Français](x.fr.md)\n\n# Title\n'), '\n# Title\n');
  assert.deepEqual(splitTitle('x.fr.md', withoutHead(french)), { title: 'Titre', body: 'Corps.\n' });
  assert.throws(() => splitTitle('x.md', 'Text first.\n\n# Title\n'), /does not start with a "# Title" line/);
  assert.equal(plainText('`ddd-ts-kit.config.json` and [a *link*](x.md)'), 'ddd-ts-kit.config.json and a link');
  assert.equal(plainText('a <scr<script>ipt> b'), 'a ipt> b');
  assert.equal(plainText('<b>bold</b> text'), 'bold text');
});

test('the banner of a README on GitHub keeps its title and its pitch on the site, and drops the rest', () => {
  const readme = [
    '**English** · [Français](README.fr.md)',
    '',
    '<div align="center">',
    '',
    '<img src="docs/assets/logo.svg" alt="" width="128" height="128">',
    '',
    '# ddd-ts-kit',
    '',
    'The pitch, on',
    'two lines.',
    '',
    '[![CI](https://example.com/badge.svg)](https://example.com)',
    '',
    '</div>',
    '',
    '## Why',
    '',
  ].join('\n');

  assert.deepEqual(splitTitle('README.md', withoutHead(readme)), {
    title: 'ddd-ts-kit',
    body: 'The pitch, on two lines.\n\n## Why\n',
  });
  assert.equal(withoutBanner('# Title\n\nBody.\n'), '# Title\n\nBody.\n');
  assert.throws(() => withoutBanner('<div align="center">\n\n# Title\n'), /without its <\/div> line/);
});

test('a link to a page leads to its route in the language of the page linked, its anchor kept', () => {
  const english = rewritten('docs/concepts/aggregates.md');
  const french = rewritten('docs/concepts/aggregates.fr.md');

  assert.match(english, /\[the outbox\]\(\/ddd-ts-kit\/concepts\/transactional-outbox\/#the-relay\)/);
  assert.match(english, /\[the top\]\(#_top\)/);
  assert.match(english, /\[the packages\]\(\/ddd-ts-kit\/packages\/kernel\/\)/);
  assert.match(english, /const link = "\[x\]\(nowhere\.md\)";/);
  assert.match(french, /\(\/ddd-ts-kit\/fr\/concepts\/transactional-outbox\/#le-relais\)/);
  assert.match(french, /`\[x\]\(nowhere\.md\)`/);
  assert.match(rewritten('README.md', SMALL['README.md']), /\[Français\]\(\/ddd-ts-kit\/fr\/start\/\)/);
});

test('a link to another file leads to GitHub, a diagram to its copy on the site, an external link stays', () => {
  assert.match(
    rewritten('docs/concepts/aggregates.md'),
    new RegExp(`\\[the code\\]\\(${BLOB}packages/kernel/src/index.ts\\)`),
  );
  assert.match(rewritten('README.md'), /\(\/ddd-ts-kit\/diagrams\/ddd-ts-kit-workflow\.svg\)/);
  assert.equal(rewritten('README.md', '[log](CHANGELOG.md)'), `[log](${BLOB}CHANGELOG.md)`);
  assert.equal(
    rewritten('README.md', '[packages](packages)'),
    '[packages](https://github.com/gbourgeat/ddd-ts-kit/tree/main/packages)',
  );
  assert.equal(rewritten('README.md', `![x](${RAW}LICENSE)`), `![x](${RAW}LICENSE)`);
  assert.equal(rewritten('README.md', '[site](https://example.com/a.md)'), '[site](https://example.com/a.md)');
});

test('a link that leads nowhere fails, and so does a page in scope without a route', () => {
  assert.throws(() => rewritten('README.md', '[gone](docs/gone.md)'), /links to docs\/gone\.md, which does not exist/);
  assert.throws(
    () => sitePages(repository({ ...SMALL, ...pair('notes/idea.md', ['Idea', 'x'], ['Idée', 'x']) })),
    /No route on the site for notes\/idea\.md/,
  );
});

test('a mermaid block becomes an escaped <pre class="mermaid">, and the summary becomes the description', () => {
  assert.equal(
    mermaidBlocks('Before.\n\n```mermaid\nA["a<br/>b"] --> B & C\n```\n'),
    'Before.\n\n<pre class="mermaid">A["a&lt;br/&gt;b"] --&gt; B &amp; C</pre>\n',
  );
  assert.equal(
    descriptionOf('**Summary.** An aggregate is a [boundary](x.md).\n\nMore.'),
    'An aggregate is a boundary.',
  );
  assert.equal(descriptionOf('| a | b |\n|---|---|'), undefined);
  assert.equal(
    pitchOf('**English** · x\n\n# ddd-ts-kit\n\nThe pitch, on\ntwo lines.\n\nMore.'),
    'The pitch, on two lines.',
  );
});

test('the assembly writes every page in both languages with its frontmatter, the home pages, the diagrams and the favicon', () => {
  const root = repository({ ...SMALL, 'docs/assets/logo.svg': '<svg/>' });
  const content = path.join(root, 'out/content');
  const favicon = path.join(root, 'out/public/favicon.svg');
  const written = assemble(root, { content, diagrams: path.join(root, 'out/diagrams'), favicon });
  const aggregates = fs.readFileSync(path.join(content, 'concepts/aggregates.md'), 'utf8');

  assert.deepEqual(written, { pages: 10, diagrams: 2 });
  assert.match(
    aggregates,
    /^---\ntitle: "Aggregates"\ndescription: "An aggregate is a boundary\."\neditUrl: "https:\/\/github\.com\/gbourgeat\/ddd-ts-kit\/edit\/main\/docs\/concepts\/aggregates\.md"\n---\n\n\*\*Summary\.\*\*/,
  );
  assert.doesNotMatch(aggregates, /# Aggregates|English/);
  assert.match(fs.readFileSync(path.join(content, 'fr/concepts/aggregates.md'), 'utf8'), /^---\ntitle: "Agrégats"/);
  assert.match(fs.readFileSync(path.join(content, 'start.md'), 'utf8'), /sidebar:\n {2}label: "Overview"/);
  assert.match(
    fs.readFileSync(path.join(content, 'fr/index.mdx'), 'utf8'),
    /tagline: "Le pitch\."\n {2}image:\n {4}file: "\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/docs\/assets\/logo\.svg"[\s\S]*\(\/ddd-ts-kit\/diagrams\/ddd-ts-kit-workflow\.fr\.svg\)/,
  );
  assert.ok(fs.existsSync(path.join(root, 'out/diagrams/ddd-ts-kit-workflow.fr.svg')));
  assert.equal(fs.readFileSync(favicon, 'utf8'), '<svg/>');
});

test('the sidebar of the repository links every page once, the concepts in the order of their reading path', () => {
  const items = sidebar(REPOSITORY_ROOT);
  const routes = sidebarRoutes(items);
  const english = [...sitePages(REPOSITORY_ROOT).values()].filter((page) => page.locale === 'en');
  const concepts = items.find((item) => item.label === 'Concepts');

  assert.deepEqual([...routes].sort(), english.map((page) => page.route).sort());
  assert.equal(new Set(routes).size, routes.length);
  assert.deepEqual(
    items.map((item) => item.translations.fr),
    [
      'Démarrer',
      'Concepts',
      'Guides',
      'Outils',
      'Architecture et configuration',
      'Packages',
      'Règles',
      'Exemple',
      'Contribuer',
    ],
  );
  assert.deepEqual(concepts.items[1].items.slice(0, 2), [
    { slug: 'concepts/domain-and-subdomains' },
    { slug: 'concepts/bounded-context' },
  ]);
  assert.equal(concepts.items[1].translations.fr, 'Conception stratégique');
});

test('the check of the built site names each page in English or French without its HTML page', () => {
  const dist = repository({
    'index.html': '',
    'fr/index.html': '',
    'start/index.html': '<img src="/ddd-ts-kit/diagrams/gone.svg">',
  });
  const problems = builtProblems(repository(SMALL), dist);

  assert.ok(problems.includes('README.fr.md: no page at /ddd-ts-kit/fr/start/ in the built site'));
  assert.ok(
    problems.includes('docs/concepts/aggregates.md: no page at /ddd-ts-kit/concepts/aggregates/ in the built site'),
  );
  assert.ok(problems.includes('/ddd-ts-kit/start/: shows the diagram gone.svg, which is not in the built site'));
  assert.ok(!problems.some((problem) => problem.startsWith('README.md:')));
});
