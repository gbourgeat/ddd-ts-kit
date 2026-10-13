#!/usr/bin/env node
/**
 * Writes the content of the site from the Markdown pages of the repository, which stay the only
 * source: every English page in scope of the French documentation goes to its route
 * (scripts/routes.mjs), its French page to the same route under fr/.
 *
 * For each page: the language switcher and the translation-of line are dropped; the first
 * `# Heading` becomes the title of the page; the rest is kept as written, except the links: a
 * link to another page goes to its route, a link to a diagram to the copy under public/diagrams/,
 * a link to any other file of the repository to that file on GitHub. A link that leads nowhere
 * fails the assembly, so a broken link fails the build of the site. A mermaid block becomes a
 * <pre class="mermaid"> that the browser draws (src/components/Head.astro).
 *
 *   node site/scripts/assemble.mjs     writes site/src/content/docs/ and site/public/diagrams/
 *
 * Plain Node, no dependency.
 */
import fs from 'node:fs';
import path from 'node:path';
import { englishPages, frenchOf, githubSlug, withoutTags } from '../../pipeline/monorepo/translations.mjs';
import { homePage } from './home.mjs';
import {
  BASE,
  contentFileOf,
  githubBlob,
  githubEdit,
  githubTree,
  hrefOf,
  localeOf,
  parentRoutes,
  routeOf,
} from './routes.mjs';

const SITE_ROOT = path.resolve(import.meta.dirname, '..');
const REPOSITORY_ROOT = path.resolve(SITE_ROOT, '..');
const DIAGRAMS = 'docs/assets/diagrams/';
const RAW = 'https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/';
const ENGLISH_SWITCHER = /^\*\*English\*\* · \[Français\]\(.*\)$/;
const FRENCH_SWITCHER = /^\[English\]\(.*\) · \*\*Français\*\*$/;
const TRANSLATION_OF = /^<!-- translation-of: .* -->$/;
const DESCRIPTION_LENGTH = 200;

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === import.meta.filename) {
  try {
    const written = assemble(REPOSITORY_ROOT, {
      content: path.join(SITE_ROOT, 'src/content/docs'),
      diagrams: path.join(SITE_ROOT, 'public/diagrams'),
    });

    console.log(`Assembled ${written.pages} pages and ${written.diagrams} diagrams.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

/** Writes the whole content of the site from the repository at `root`; answers what it wrote. */
export function assemble(root, { content, diagrams }) {
  const pages = sitePages(root);
  const files = [...pages.values()].map((page) => renderPage({ root, pages }, page));

  fs.rmSync(content, { recursive: true, force: true });
  fs.rmSync(diagrams, { recursive: true, force: true });

  for (const { file, text } of [...files, ...homePages(root)]) {
    fs.mkdirSync(path.dirname(path.join(content, file)), { recursive: true });
    fs.writeFileSync(path.join(content, file), text);
  }

  return { pages: files.length + 2, diagrams: copyDiagrams(root, diagrams) };
}

/**
 * Every page of the site by its path in the repository, English and French: `{ source, english,
 * locale, route, file }`. Fails when an English page in scope has no route.
 */
export function sitePages(root) {
  const english = englishPages(root);
  const unrouted = english.filter((page) => routeOf(page) === undefined);

  if (unrouted.length > 0) {
    throw new Error(`No route on the site for ${unrouted.join(', ')}: give it one in site/scripts/routes.mjs.`);
  }

  const parents = parentRoutes(english.map(routeOf));

  return new Map(
    english.flatMap((page) =>
      [page, frenchOf(page)].map((source) => {
        const route = routeOf(page);
        const locale = localeOf(source);
        const file = contentFileOf(route, locale, parents);
        const { title } = splitTitle(source, withoutHead(fs.readFileSync(path.join(root, source), 'utf8')));

        return [
          source,
          { source, english: page, locale, route, file, title: plainText(title), titleSlug: githubSlug(title) },
        ];
      }),
    ),
  );
}

/**
 * The content file of one page: frontmatter, then the body with its links rewritten. `repository`
 * is `{ root, pages }`: where the repository is, and every page of the site by its source.
 */
function renderPage(repository, page) {
  const text = fs.readFileSync(path.join(repository.root, page.source), 'utf8');
  const { title, body } = splitTitle(page.source, withoutHead(text));
  const rewritten = rewriteLinks(repository, page, mermaidBlocks(body));
  const frontmatter = {
    title: plainText(title),
    description: descriptionOf(rewritten),
    editUrl: githubEdit(page.source),
    sidebar: sidebarOf(page, text),
  };

  return { file: page.file, text: `${yamlFrontmatter(frontmatter)}\n${rewritten}` };
}

/** The text without its language switcher and its translation-of line, nor the blank lines after them. */
export function withoutHead(text) {
  const lines = text.split('\n');
  let start = 0;

  if (ENGLISH_SWITCHER.test(lines[0] ?? '') || FRENCH_SWITCHER.test(lines[0] ?? '')) {
    start = 1;
  }

  if (TRANSLATION_OF.test(lines[start] ?? '')) {
    start += 1;
  }

  return lines.slice(start).join('\n');
}

/** The first level-one heading as the title, and what follows it as the body. */
export function splitTitle(source, text) {
  const lines = text.split('\n');
  const index = lines.findIndex((line) => /^# \S/.test(line));

  if (index === -1 || lines.slice(0, index).some((line) => line.trim() !== '')) {
    throw new Error(`${source}: the page does not start with a "# Title" line.`);
  }

  const body = lines.slice(index + 1);
  const first = body.findIndex((line) => line.trim() !== '');

  return { title: lines[index].slice(2).trim(), body: body.slice(first === -1 ? body.length : first).join('\n') };
}

/** A fenced mermaid block becomes a <pre class="mermaid"> block, its text escaped, for the browser to draw. */
export function mermaidBlocks(body) {
  return body.replace(
    /^```mermaid\n([\s\S]*?)\n```$/gm,
    (_, diagram) => `<pre class="mermaid">${escapeHtml(diagram)}</pre>`,
  );
}

/**
 * Every link target of the body, outside code, rewritten for the site: `](target)`, `[ref]: target`,
 * `src="target"` and `href="target"`. Fails on a target that leads nowhere. `repository` is
 * `{ root, pages }`, as for renderPage.
 */
export function rewriteLinks(repository, page, body) {
  let fence;

  return body
    .split('\n')
    .map((line) => {
      const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];

      if (fence !== undefined) {
        const closes = marker !== undefined && marker[0] === fence[0] && marker.length >= fence.length;
        fence = closes && line.trim() === marker ? undefined : fence;
        return line;
      }

      if (marker !== undefined) {
        fence = marker;
        return line;
      }

      return outsideCode(line, (prose) => rewriteProse(prose, (target) => linkTarget(repository, page, target)));
    })
    .join('\n');
}

/** Where one link target of a page leads on the site. */
function linkTarget(repository, page, target) {
  const bare = target.replace(/^<(.*)>$/, '$1');

  if (bare.startsWith(RAW)) {
    const file = bare.slice(RAW.length);
    return file.startsWith(DIAGRAMS) ? `${BASE}/diagrams/${file.slice(DIAGRAMS.length)}` : target;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(bare) || bare.startsWith('//')) {
    return target;
  }

  const [pathPart = '', anchor] = bare.split('#');

  if (pathPart === '') {
    return `#${siteAnchor(anchor ?? '', page)}`;
  }

  const file = path.posix
    .normalize(path.posix.join(path.posix.dirname(page.source), decodeURIComponent(pathPart)))
    .replace(/\/$/, '');
  const readme = `${file}/${page.locale === 'fr' ? 'README.fr.md' : 'README.md'}`;
  const linked = repository.pages.get(file) ?? repository.pages.get(readme);

  if (linked !== undefined) {
    return `${hrefOf(linked.route, linked.locale)}${anchor ? `#${siteAnchor(anchor, linked)}` : ''}`;
  }

  return `${repositoryFile(repository.root, page, file)}${anchor ? `#${anchor}` : ''}`;
}

function rewriteProse(prose, rewrite) {
  return prose
    .replace(/\]\(\s*(<[^>]*>|[^\s)]+)/g, (match, target) => match.replace(target, rewrite(target)))
    .replace(/^(\s{0,3}\[[^\]]+\]:\s*)(<[^>]*>|\S+)/, (_, head, target) => `${head}${rewrite(target)}`)
    .replace(/\b(src|href)="([^"]*)"/g, (_, attribute, target) => `${attribute}="${rewrite(target)}"`);
}

/** Applies `rewrite` to the parts of a line that are not inline code. */
function outsideCode(line, rewrite) {
  const parts = line.split(/((`+)[^`]+?\2)/);
  let result = '';

  for (let index = 0; index < parts.length; index += 3) {
    result += rewrite(parts[index] ?? '') + (parts[index + 1] ?? '');
  }

  return result;
}

/** A file of the repository that is not a page: a diagram of the site, or the file on GitHub. */
function repositoryFile(root, page, file) {
  if (file.startsWith(DIAGRAMS) && file.endsWith('.svg')) {
    return `${BASE}/diagrams/${file.slice(DIAGRAMS.length)}`;
  }

  if (!fs.existsSync(path.join(root, file))) {
    throw new Error(`${page.source}: links to ${file}, which does not exist.`);
  }

  return fs.statSync(path.join(root, file)).isDirectory() ? githubTree(file) : githubBlob(file);
}

/** The anchor of the title of a page is `_top` on the site, where the title is no heading of the body. */
function siteAnchor(anchor, page) {
  return decodeURIComponent(anchor) === page.titleSlug ? '_top' : anchor;
}

function homePages(root) {
  return ['en', 'fr'].map((locale) => ({
    file: locale === 'fr' ? 'fr/index.mdx' : 'index.mdx',
    text: homePage(root, locale),
  }));
}

function copyDiagrams(root, destination) {
  const source = path.join(root, DIAGRAMS);
  const names = fs.readdirSync(source).filter((name) => name.endsWith('.svg'));

  fs.mkdirSync(destination, { recursive: true });

  for (const name of names) {
    fs.copyFileSync(path.join(source, name), path.join(destination, name));
  }

  return names.length;
}

/** The first paragraph of prose, without its Markdown, cut after a sentence: what search engines show. */
export function descriptionOf(body) {
  const paragraph = body.split(/\n\s*\n/)[0] ?? '';

  if (!/^[\p{L}*[`]/u.test(paragraph.trim())) {
    return undefined;
  }

  const text = plainText(paragraph.replace(/^\*\*(Summary|Résumé)\.\*\*\s*/, ''));

  if (text.length <= DESCRIPTION_LENGTH) {
    return text;
  }

  const sentence = text.slice(0, DESCRIPTION_LENGTH).lastIndexOf('. ');

  return sentence > 40 ? text.slice(0, sentence + 1) : `${text.slice(0, DESCRIPTION_LENGTH).replace(/\s+\S*$/, '')}...`;
}

/** Inline Markdown as plain text: links as their text, no code marks, no emphasis, one line. */
export function plainText(markdown) {
  return withoutTags(markdown.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[`*]/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
}

/** The label of a page in the sidebar when its title is too long or not the name readers look for. */
function sidebarOf(page, text) {
  if (page.route.startsWith('rules/')) {
    const id = /^(?:Architecture id|Identifiant d'architecture)\s?: `([^`]+)`/m.exec(text)?.[1];
    return id === undefined ? undefined : { label: id };
  }

  if (page.route === 'start') {
    return { label: page.locale === 'fr' ? "Vue d'ensemble" : 'Overview' };
  }

  if (page.route === 'documentation') {
    return { label: page.locale === 'fr' ? 'Index de la documentation' : 'Documentation index' };
  }

  if (page.route === 'packages/cli') {
    return { label: 'ddd-ts-kit (CLI)' };
  }

  return undefined;
}

function yamlFrontmatter(fields) {
  const lines = Object.entries(fields).flatMap(([key, value]) => yamlField(key, value, ''));

  return `---\n${lines.join('\n')}\n---\n`;
}

function yamlField(key, value, indent) {
  if (value === undefined) {
    return [];
  }

  if (typeof value === 'object') {
    return [`${indent}${key}:`, ...Object.entries(value).flatMap(([inner, v]) => yamlField(inner, v, `${indent}  `))];
  }

  return [`${indent}${key}: ${JSON.stringify(value)}`];
}

function escapeHtml(text) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
