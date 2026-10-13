#!/usr/bin/env node
/**
 * The French documentation. Every reader-facing page X.md has a sibling X.fr.md in the same
 * directory, which says on its second line which version of X.md it translates. The conventions
 * (switchers, glossary, diagrams, checked samples) are in docs/translation.md.
 *
 * In scope: every .md file of the repository, except
 *   - the French pages themselves (*.fr.md);
 *   - every CHANGELOG.md, CLAUDE.md and CONTEXT.md (a CONTEXT.md is partly generated);
 *   - anything under a directory named node_modules, dist, coverage, reports, .git, .claude,
 *     .github, .gitlab or .ddd-ts-kit, wherever it is;
 *   - anything under plugin/, pipeline/ and packages/cli/templates/;
 *   - the generated examples/scheduling/clients/api/README.md and
 *     examples/scheduling/docs/integration/event-catalog.md.
 *
 *   node pipeline/monorepo/translations.mjs --check [pages...]  one line per problem, exit 1 if any
 *                                                              (pages: English or French, all without)
 *   node pipeline/monorepo/translations.mjs --stamp <X.md>      writes the translation-of line of X.fr.md
 *   node pipeline/monorepo/translations.mjs --stale             the French pages whose English page changed
 *   node pipeline/monorepo/translations.mjs --add-switchers     the switcher line, on every English page lacking it
 *
 * The script needs no dependency: it runs in the docs job of the pipeline, before any install.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  'coverage',
  'reports',
  '.git',
  '.claude',
  '.github',
  '.gitlab',
  '.ddd-ts-kit',
]);
const SKIPPED_PREFIXES = ['plugin/', 'pipeline/', 'packages/cli/templates/'];
const SKIPPED_NAMES = new Set(['CHANGELOG.md', 'CLAUDE.md', 'CONTEXT.md']);
const SKIPPED_FILES = new Set([
  'examples/scheduling/clients/api/README.md',
  'examples/scheduling/docs/integration/event-catalog.md',
]);
const DIAGRAMS = 'docs/assets/diagrams/';
const RAW = 'https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/';
const TRANSLATION_OF = /^<!-- translation-of: (\S+) sha256:([0-9a-f]{16}) -->$/;
const MAX_DIAGRAM_WIDTH = 960;
const MIN_FONT_SIZE = 13;
/** Where each kind of markup that holds no element ends: comments, character data, instructions. */
const NON_ELEMENTS = [
  ['<!--', '-->'],
  ['<![CDATA[', ']]>'],
  ['<?', '?>'],
];

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === import.meta.filename) {
  process.exit(main(process.argv.slice(2)));
}

function main(args) {
  const [command, ...rest] = args;
  const files = rest.map((file) => toPosix(path.relative(ROOT, path.resolve(file))));

  switch (command) {
    case '--check':
      return report(check(ROOT, files));
    case '--stamp':
      return runStamp(files);
    case '--stale':
      for (const french of stale(ROOT)) {
        console.log(`${french} translates an older ${englishOf(french)}`);
      }

      return 0;
    case '--add-switchers':
      for (const page of addSwitchers(ROOT)) {
        console.log(`switcher added: ${page}`);
      }

      return 0;
    default:
      console.error('Usage: translations.mjs --check [pages...] | --stamp <X.md> | --stale | --add-switchers');
      return 2;
  }
}

function report(problems) {
  for (const problem of problems) {
    console.log(problem);
  }

  console.log(
    problems.length === 0
      ? 'The French documentation is complete and current.'
      : `\n${problems.length} translation problem(s). The conventions are in docs/translation.md.`,
  );

  return problems.length === 0 ? 0 : 1;
}

function runStamp(files) {
  if (files.length === 0) {
    console.error('--stamp takes the English page whose French page it stamps: --stamp docs/concepts/aggregates.md');
    return 2;
  }

  try {
    for (const english of files) {
      console.log(`stamped: ${stamp(ROOT, english)}`);
    }

    return 0;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}

/** Every problem of the French documentation, or of the given pages only (English or French paths, or diagrams). */
export function check(root, only = []) {
  const pages = englishPages(root);
  const unknown = only.filter(
    (file) => !file.endsWith('.svg') && !pages.some((page) => file === page || file === frenchOf(page)),
  );
  const selected =
    only.length === 0 ? pages : pages.filter((page) => only.includes(page) || only.includes(frenchOf(page)));
  const diagrams =
    only.length === 0
      ? diagramFiles(root)
      : [
          ...new Set([
            ...selected.flatMap((page) => shownDiagrams(root, page)),
            ...only.filter((file) => file.endsWith('.svg')),
          ]),
        ];

  return [
    ...unknown.map((file) => `${file}: not a page in scope of the French documentation`),
    ...selected.flatMap((page) => pageProblems(root, page)),
    ...diagrams.flatMap((diagram) => diagramProblems(root, diagram)),
  ];
}

/** The English pages in scope, as paths relative to the root, sorted. */
export function englishPages(root) {
  return markdownFiles(root, '').filter(inScope).sort();
}

/** Whether a path relative to the root (with `/`) is an English page in scope. */
export function inScope(file) {
  const directories = file.split('/').slice(0, -1);

  return (
    file.endsWith('.md') &&
    !file.endsWith('.fr.md') &&
    !SKIPPED_NAMES.has(path.posix.basename(file)) &&
    !SKIPPED_FILES.has(file) &&
    !SKIPPED_PREFIXES.some((prefix) => file.startsWith(prefix)) &&
    !directories.some((directory) => SKIPPED_DIRECTORIES.has(directory))
  );
}

/** Writes or refreshes the translation-of line of the French page of `english`, and returns its path. */
export function stamp(root, english) {
  if (!inScope(english)) {
    throw new Error(`${english} is not an English page in scope of the French documentation.`);
  }

  const french = frenchOf(english);

  if (!fs.existsSync(path.join(root, french))) {
    throw new Error(`${french} does not exist: write the translation of ${english} first, then stamp it.`);
  }

  const lines = fs.readFileSync(path.join(root, french), 'utf8').split('\n');
  const hash = contentHash(english, fs.readFileSync(path.join(root, english)));
  const body = lines.slice(/^\[English\]\(.*\) · \*\*Français\*\*$/.test(lines[0] ?? '') ? 1 : 0);
  const rest = /^<!-- translation-of:/.test(body[0] ?? '') ? body.slice(1) : body;
  const next = [frenchSwitcher(english), translationLine(english, hash), ...(rest[0] === '' ? [] : ['']), ...rest];

  fs.writeFileSync(path.join(root, french), next.join('\n'));
  return french;
}

/** The French pages whose recorded hash is not the hash of their English page today. */
export function stale(root) {
  return englishPages(root)
    .filter((english) => fs.existsSync(path.join(root, frenchOf(english))))
    .filter(
      (english) => recordedHash(root, english) !== contentHash(english, fs.readFileSync(path.join(root, english))),
    )
    .map(frenchOf);
}

/** Puts the switcher on the first line of every English page in scope that lacks it; answers the pages changed. */
export function addSwitchers(root) {
  return englishPages(root).filter((english) => {
    const text = fs.readFileSync(path.join(root, english), 'utf8');
    const lines = text.split('\n');
    const switcher = englishSwitcher(english);

    if (lines[0] === switcher && lines[1] === '') {
      return false;
    }

    const body = /^\*\*English\*\* · /.test(lines[0] ?? '') ? lines.slice(1) : lines;
    const next = [switcher, ...(body[0] === '' ? [] : ['']), ...body];

    fs.writeFileSync(path.join(root, english), next.join('\n'));
    return true;
  });
}

export function frenchOf(english) {
  return english.replace(/\.md$/, '.fr.md');
}

export function englishOf(french) {
  return french.replace(/\.fr\.md$/, '.md');
}

export function englishSwitcher(english) {
  return `**English** · [Français](${path.posix.basename(english, '.md')}.fr.md)`;
}

export function frenchSwitcher(english) {
  return `[English](${path.posix.basename(english)}) · **Français**`;
}

export function translationLine(english, hash) {
  return `<!-- translation-of: ${path.posix.basename(english)} sha256:${hash} -->`;
}

/** The first 16 hex digits of the sha256 of the English page, its switcher line left out. */
export function contentHash(english, bytes) {
  const newline = bytes.indexOf(10);
  const end = newline === -1 ? bytes.length : newline;
  const first = bytes.subarray(0, end).toString('utf8');
  const body = first === englishSwitcher(english) ? bytes.subarray(Math.min(end + 1, bytes.length)) : bytes;

  return createHash('sha256').update(body).digest('hex').slice(0, 16);
}

function markdownFiles(root, directory) {
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const file = directory === '' ? entry.name : `${directory}/${entry.name}`;

    if (entry.isDirectory()) {
      const skipped = SKIPPED_DIRECTORIES.has(entry.name) || SKIPPED_PREFIXES.includes(`${file}/`);
      return skipped ? [] : markdownFiles(root, file);
    }

    return entry.isFile() && entry.name.endsWith('.md') ? [file] : [];
  });
}

function pageProblems(root, english) {
  const french = frenchOf(english);
  const text = fs.readFileSync(path.join(root, english), 'utf8');
  const problems = [...englishHeadProblems(english, text), ...linkProblems(root, english, text)];

  if (!fs.existsSync(path.join(root, french))) {
    return [...problems, `${french}: missing: the French page of ${english}; write it, then --stamp ${english}`];
  }

  const frenchText = fs.readFileSync(path.join(root, french), 'utf8');

  return [
    ...problems,
    ...frenchHeadProblems(root, english, frenchText),
    ...linkProblems(root, french, frenchText),
    ...diagramPlacementProblems(root, english, { english: text, french: frenchText }),
  ];
}

function englishHeadProblems(english, text) {
  const lines = text.split('\n');

  if (lines[0] !== englishSwitcher(english)) {
    return [`${english}:1: the first line is not the switcher "${englishSwitcher(english)}": run --add-switchers`];
  }

  return lines[1] === '' ? [] : [`${english}:2: a blank line follows the switcher`];
}

function frenchHeadProblems(root, english, text) {
  const french = frenchOf(english);
  const lines = text.split('\n');
  const recorded = TRANSLATION_OF.exec(lines[1] ?? '');

  if (lines[0] !== frenchSwitcher(english)) {
    return [`${french}:1: the first line is not the switcher "${frenchSwitcher(english)}"`];
  }

  if (recorded === null || recorded[1] !== path.posix.basename(english)) {
    return [`${french}:2: the second line is not "${translationLine(english, '<hash>')}": run --stamp ${english}`];
  }

  if (recorded[2] !== contentHash(english, fs.readFileSync(path.join(root, english)))) {
    return [`stale: ${french} translates an older ${english}: update it, then --stamp`];
  }

  return lines[2] === '' ? [] : [`${french}:3: a blank line follows the translation-of line`];
}

function recordedHash(root, english) {
  const lines = fs.readFileSync(path.join(root, frenchOf(english)), 'utf8').split('\n');
  return TRANSLATION_OF.exec(lines[1] ?? '')?.[2];
}

function linkProblems(root, page, text) {
  const french = page.endsWith('.fr.md');
  const anchors = anchorsOf(text);
  const switcher = french ? frenchSwitcher(englishOf(page)) : englishSwitcher(page);
  const skipped = text.split('\n')[0] === switcher ? 1 : 0;

  return linksOf(text).flatMap(({ line, target }) => {
    const where = `${page}:${line}`;
    const link = resolveLink(page, target);

    if (link === undefined || line === skipped) {
      return [];
    }

    if (link.file === '') {
      return link.anchor === '' || anchors.has(link.anchor)
        ? []
        : [`${where}: no heading of this page has the anchor #${link.anchor}`];
    }

    if (!fs.existsSync(path.join(root, link.file))) {
      return [`${where}: ${target} does not resolve to a file`];
    }

    return [
      ...(french && inScope(link.file) && fs.existsSync(path.join(root, frenchOf(link.file)))
        ? [`${where}: links to the English page ${link.file}: link its French page ${frenchOf(link.file)}`]
        : []),
      ...diagramReferenceProblems(page, where, link),
    ];
  });
}

function diagramReferenceProblems(page, where, link) {
  if (!link.file.startsWith(DIAGRAMS)) {
    return [];
  }

  const underDocs = page.startsWith('docs/');

  if (underDocs && link.absolute) {
    return [`${where}: a page under docs/ shows a diagram by a relative path, not ${RAW}${link.file}`];
  }

  if (!underDocs && !link.absolute) {
    return [
      `${where}: a page outside docs/ shows a diagram by its absolute URL, so that npm renders it: ${RAW}${link.file}`,
    ];
  }

  if (!page.endsWith('.fr.md') && link.file.endsWith('.fr.svg')) {
    return [`${where}: an English page shows the English drawing, not ${link.file}`];
  }

  return [];
}

function diagramPlacementProblems(root, english, texts) {
  const french = frenchOf(english);
  const shown = diagramsOf(english, texts.english);
  const expected = shown.map((diagram) => diagram.replace(/(?<!\.fr)\.svg$/, '.fr.svg'));
  const actual = diagramsOf(french, texts.french);
  const missing = expected
    .filter((diagram) => !fs.existsSync(path.join(root, diagram)))
    .map((diagram) => `${diagram}: missing: the French drawing shown by ${french}`);

  if (expected.join(' ') === actual.join(' ')) {
    return missing;
  }

  return [
    ...missing,
    `${french}: shows [${actual.join(', ')}] where ${english} shows [${shown.join(', ')}]: show [${expected.join(', ')}], at the same places`,
  ];
}

/** The diagrams a page shows, in order, as paths relative to the root. */
function diagramsOf(page, text) {
  return linksOf(text)
    .map(({ target }) => resolveLink(page, target)?.file ?? '')
    .filter((file) => file.startsWith(DIAGRAMS) && file.endsWith('.svg'));
}

function shownDiagrams(root, english) {
  const french = frenchOf(english);
  const pages = [english, ...(fs.existsSync(path.join(root, french)) ? [french] : [])];

  return pages
    .flatMap((page) => diagramsOf(page, fs.readFileSync(path.join(root, page), 'utf8')))
    .filter((diagram) => fs.existsSync(path.join(root, diagram)));
}

/**
 * Where a link of a page leads: `{ file, anchor, absolute }`, with `file` relative to the root
 * (empty for an anchor of the page itself), or undefined for an external link.
 */
function resolveLink(page, target) {
  const bare = target.replace(/^<(.*)>$/, '$1');

  if (bare.startsWith(RAW)) {
    return { file: decoded(bare.slice(RAW.length).replace(/[?#].*$/, '')), anchor: '', absolute: true };
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(bare) || bare.startsWith('//')) {
    return undefined;
  }

  const [pathPart = '', anchor = ''] = bare.replace(/\?[^#]*/, '').split('#');

  if (pathPart === '') {
    return { file: '', anchor: decoded(anchor), absolute: false };
  }

  const joined = pathPart.startsWith('/') ? pathPart.slice(1) : path.posix.join(path.posix.dirname(page), pathPart);
  return { file: path.posix.normalize(decoded(joined)).replace(/\/$/, ''), anchor: decoded(anchor), absolute: false };
}

function decoded(text) {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** The link and image targets of a Markdown text, outside code: `](x)`, `[ref]: x`, `src="x"`, `href="x"`. */
function linksOf(text) {
  return proseLines(text).flatMap(({ line, content }) =>
    [
      ...content.matchAll(/\]\(\s*(<[^>]*>|[^\s)]+)/g),
      ...content.matchAll(/^\s{0,3}\[[^\]]+\]:\s*(<[^>]*>|\S+)/g),
      ...content.matchAll(/\b(?:src|href)="([^"]*)"/g),
    ].map((match) => ({ line, target: match[1] ?? '' })),
  );
}

/** The lines of a Markdown text outside fenced code, with their numbers: as written, and inline code removed. */
function proseLines(text) {
  let fence;

  return text.split('\n').flatMap((content, index) => {
    const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(content)?.[1];

    if (fence !== undefined) {
      const closes = marker !== undefined && marker[0] === fence[0] && marker.length >= fence.length;
      fence = closes && content.trim() === marker ? undefined : fence;
      return [];
    }

    if (marker !== undefined) {
      fence = marker;
      return [];
    }

    return [{ line: index + 1, raw: content, content: content.replace(/(`+)[^`]+?\1/g, '') }];
  });
}

/** The anchors GitHub gives the headings of a page, and the ids it declares itself. */
export function anchorsOf(text) {
  const seen = new Map();
  const anchors = new Set();

  for (const { raw, content } of proseLines(text)) {
    for (const match of content.matchAll(/<a\s+(?:id|name)="([^"]+)"/g)) {
      anchors.add(match[1]);
    }

    const heading = /^\s{0,3}#{1,6}\s+(.*?)(?:\s+#+)?\s*$/.exec(raw)?.[1];

    if (heading !== undefined) {
      const slug = githubSlug(heading);
      const count = seen.get(slug) ?? 0;

      anchors.add(count === 0 ? slug : `${slug}-${count}`);
      seen.set(slug, count + 1);
    }
  }

  return anchors;
}

/** The slug GitHub derives from a heading: its text, lower case, punctuation removed, spaces as hyphens. */
export function githubSlug(heading) {
  return withoutTags(heading.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1'))
    .replace(/[*`]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
    .replaceAll(' ', '-');
}

/**
 * The text without its HTML tags, read once from the left: what is left when
 * a tag is removed is never read again as a tag, so nothing is stripped twice.
 */
function withoutTags(text) {
  let kept = '';
  let index = 0;

  while (index < text.length) {
    const end = text[index] === '<' ? text.indexOf('>', index + 1) : -1;

    if (end > index + 1) {
      index = end + 1;
    } else {
      kept += text[index];
      index += 1;
    }
  }

  return kept;
}

function diagramFiles(root) {
  const directory = path.join(root, DIAGRAMS);

  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs
    .readdirSync(directory)
    .filter((name) => name.endsWith('.svg'))
    .sort()
    .map((name) => `${DIAGRAMS}${name}`);
}

/** The problems of one diagram: its pair, then a small well-formedness check that needs no XML parser. */
export function diagramProblems(root, diagram) {
  const twin = diagram.endsWith('.fr.svg')
    ? diagram.replace(/\.fr\.svg$/, '.svg')
    : diagram.replace(/\.svg$/, '.fr.svg');
  const pair = fs.existsSync(path.join(root, twin))
    ? []
    : [`${diagram}: has no ${twin}: every drawing exists in English and in French`];

  if (!fs.existsSync(path.join(root, diagram))) {
    return [`${diagram}: does not exist`];
  }

  return [
    ...pair,
    ...svgProblems(fs.readFileSync(path.join(root, diagram), 'utf8')).map((problem) => `${diagram}: ${problem}`),
  ];
}

/** What a hand-written diagram must not be: see "Diagrams" in docs/translation.md. */
export function svgProblems(text) {
  const opening = /^<svg\b(?:[^>"']|"[^"]*"|'[^']*')*>/.exec(text.replace(/^\uFEFF/, '').trimStart())?.[0];
  const width = Number(/\swidth="(\d+(?:\.\d+)?)"/.exec(opening ?? '')?.[1] ?? 0);
  const references = [...text.matchAll(/\b(?:xlink:)?href\s*=\s*["']([^"']*)["']/g)].map((match) => match[1] ?? '');
  const sizes = [...text.matchAll(/font-size\s*[:=]\s*["']?(\d+(?:\.\d+)?)/g)].map((match) => Number(match[1]));

  return [
    ...(opening === undefined ? ['does not start with <svg'] : []),
    ...(opening !== undefined && !/\sviewBox="[^"]+"/.test(opening) ? ['has no viewBox'] : []),
    ...(width > MAX_DIAGRAM_WIDTH ? [`is ${width} wide: at most ${MAX_DIAGRAM_WIDTH}`] : []),
    ...(/<title\b[^>]*>[^<]+<\/title>/.test(text) ? [] : ['has no <title>']),
    ...(/<desc\b[^>]*>[^<]+<\/desc>/.test(text) ? [] : ['has no <desc>']),
    ...(/<script\b|\son[a-z]+\s*=/i.test(text) ? ['holds a script'] : []),
    ...(/<image\b|<foreignObject\b|data:/i.test(text) ? ['embeds an image or a foreign object'] : []),
    ...(/@import|@font-face/i.test(text) ? ['loads a font or a stylesheet'] : []),
    ...references
      .filter((reference) => !reference.startsWith('#'))
      .map((reference) => `refers to ${reference}: no external reference`),
    ...(/url\(\s*['"]?(?!#)/.test(text) ? ['refers to an external url(): no external reference'] : []),
    ...sizes.filter((size) => size < MIN_FONT_SIZE).map((size) => `has a text of ${size}px: at least ${MIN_FONT_SIZE}`),
    ...malformation(text),
  ];
}

/** The first tag that is not closed in order, a stray `<` or an unescaped `&`. */
function malformation(text) {
  const tag = /<(\/?)([A-Za-z][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
  const body = withoutMarkup(text);
  const open = [];

  for (const [, closing, name, , selfClosing] of body.matchAll(tag)) {
    if (closing === '/' && open.pop() !== name) {
      return [`</${name}> closes a tag it did not open: not well formed`];
    }

    if (closing === '' && selfClosing === '') {
      open.push(name);
    }
  }

  if (open.length > 0) {
    return [`<${open.at(-1)}> is never closed: not well formed`];
  }

  if (body.replace(tag, '').includes('<')) {
    return ['holds a stray <: write &lt;'];
  }

  return /&(?![a-zA-Z]+;|#\d+;|#x[0-9a-fA-F]+;)/.test(body) ? ['holds an unescaped &: write &amp;'] : [];
}

/**
 * The text without its comments, character data and processing instructions, read once from the
 * left as an XML parser does: a `<!--` that appears once a comment is removed stays, and is then
 * reported as a stray `<`, instead of being removed by a second pass.
 */
function withoutMarkup(text) {
  let kept = '';
  let index = 0;

  while (index < text.length) {
    const kind = NON_ELEMENTS.find(([start]) => text.startsWith(start, index));
    const end = kind === undefined ? -1 : text.indexOf(kind[1], index + kind[0].length);

    if (kind !== undefined && end !== -1) {
      index = end + kind[1].length;
    } else {
      kept += text[index];
      index += 1;
    }
  }

  return kept;
}

function toPosix(file) {
  return file.split(path.sep).join('/');
}
