/**
 * The sidebar of the site, in English and in French. Where the documentation already orders its
 * pages, the sidebar follows it: the concepts in the order of their reading path
 * (docs/concepts/README.md), the tools, guides and proposals in the order of the documentation
 * index (docs/README.md), the packages in the order of the table of the root README. A page that
 * no index lists comes after the listed ones, so that no page is ever left out of the sidebar.
 * The labels of the pages are their titles (or `sidebar.label`), in the language of the page.
 */
import fs from 'node:fs';
import path from 'node:path';
import { sitePages } from './assemble.mjs';
import { routeOf } from './routes.mjs';

const GROUPS = {
  start: ['Start', 'Démarrer'],
  concepts: ['Concepts', 'Concepts'],
  guides: ['Guides', 'Guides'],
  tools: ['Tools', 'Outils'],
  reference: ['Architecture and configuration', 'Architecture et configuration'],
  proposals: ['Proposals', 'Propositions'],
  packages: ['Packages', 'Packages'],
  rules: ['Rules', 'Règles'],
  example: ['Example', 'Exemple'],
  contributing: ['Contributing', 'Contribuer'],
  architecture: ['Architecture', 'Architecture'],
  adr: ['Decision records', 'Enregistrements de décision'],
};

/** The order of the documents of the example, a step of the method after the other; the rest follows by name. */
const EXAMPLE_ORDER = [
  'architecture',
  'needs',
  'discovery',
  'contexts',
  'before-bootstrap',
  'plan',
  'slices',
  'briefings',
  'context-map',
  'adr',
  'integration',
  'commit-plan',
  'demo-transcript',
  'tooling-report',
];

const START = ['start', 'documentation', 'guides/methodology', 'guides/commands'];
const CONTRIBUTING = [
  'contributing',
  'contributing/translation',
  'contributing/security',
  'contributing/code-of-conduct',
];

/** The sidebar configuration of Starlight. */
export function sidebar(root) {
  const site = siteOf(root);

  return [
    group('start', START.map(slug)),
    group('concepts', conceptItems(site)),
    group('guides', indexedItems(site, ['docs/README.md', 'Guides'], 'guides/')),
    group('tools', indexedItems(site, ['docs/README.md', 'Tools'], 'tools/')),
    group('reference', [
      ...site.take(['architecture', 'config', ...under(site.routes, 'adr/')]).map(slug),
      group('proposals', indexedItems(site, ['docs/README.md', 'Proposals'], 'proposals/')),
    ]),
    group('packages', packageItems(site)),
    group('rules', ruleGroups(site), true),
    group('example', exampleItems(site)),
    group('contributing', CONTRIBUTING.map(slug)),
  ];
}

/** Every route the sidebar links to, in order: each route of the site is there once. */
export function sidebarRoutes(items) {
  return items.flatMap((item) => ('items' in item ? sidebarRoutes(item.items) : [item.slug]));
}

/**
 * The pages of the site seen by the sidebar: the routes, the pages by locale and route, and
 * `take`, which keeps the routes not placed yet and marks them placed, so that no page is twice.
 */
function siteOf(root) {
  const pages = [...sitePages(root).values()];
  const routes = pages.filter((page) => page.locale === 'en').map((page) => page.route);
  const placed = new Set([...START, ...CONTRIBUTING]);

  return {
    root,
    routes,
    pages: new Map(pages.map((page) => [`${page.locale}:${page.route}`, page])),
    take: (list) => list.filter((route) => routes.includes(route) && !placed.has(route) && placed.add(route)),
  };
}

/** The reading path: the page itself, then one group per numbered section, its pages in the order they are linked. */
function conceptItems(site) {
  const english = numberedSections(site.root, 'docs/concepts/README.md');
  const french = numberedSections(site.root, 'docs/concepts/README.fr.md');
  const sections = english.map(({ label, routes }, index) => ({
    label,
    translations: { fr: french[index]?.label ?? label },
    collapsed: true,
    items: site.take(routes.filter((route) => route.startsWith('concepts/'))).map(slug),
  }));
  const rest = site.take(under(site.routes, 'concepts/')).map(slug);

  return [...site.take(['concepts']).map(slug), ...sections, ...rest];
}

/** The pages under `prefix` in the order of the section of an index that lists them, then the others by name. */
function indexedItems(site, [file, heading], prefix) {
  const listed = indexed(site.root, file, heading).filter((route) => route.startsWith(prefix));

  return site.take([...listed, ...under(site.routes, prefix)]).map(slug);
}

/** One item per package in the order of the table of the root README, each followed by the pages of its docs/. */
function packageItems(site) {
  const packages = [...indexed(site.root, 'README.md', 'Packages'), ...under(site.routes, 'packages/')].filter(
    (route) => /^packages\/[^/]+$/.test(route),
  );

  return site.take(packages).flatMap((route) => [slug(route), ...site.take(under(site.routes, `${route}/`)).map(slug)]);
}

/** The rules grouped by the first part of their architecture id (`clean/stepdown` under `clean`), collapsed. */
function ruleGroups(site) {
  const rules = site.take(under(site.routes, 'rules/')).map((route) => ({
    route,
    id: architectureId(site.root, site.pages.get(`en:${route}`).source) ?? route.slice('rules/'.length),
  }));
  const prefixes = [...new Set(rules.map(({ id }) => id.split('/')[0]))].sort();

  return prefixes.map((prefix) => ({
    label: prefix,
    collapsed: true,
    items: rules
      .filter(({ id }) => id.split('/')[0] === prefix)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(({ route }) => slug(route)),
  }));
}

/** The example: its page, the page of each application, then its documents as a tree, a group per directory. */
function exampleItems(site) {
  const applications = site.routes.filter((route) => /^example\/[^/]+$/.test(route));

  return [
    ...site.take(['example']).map(slug),
    ...applications.flatMap((application) => [...site.take([application]).map(slug), ...tree(site, application)]),
  ];
}

/** The pages under a directory: a page, or a group for a subdirectory, labelled by its README when it has one. */
function tree(site, directory) {
  const depth = directory.split('/').length;
  const children = [...new Set(under(site.routes, `${directory}/`).map((route) => route.split('/')[depth]))];

  return children.sort(byExampleOrder).flatMap((name) => {
    const route = `${directory}/${name}`;
    const nested = tree(site, route);

    if (nested.length === 0) {
      return site.take([route]).map(slug);
    }

    const own = site.take([route]).map(slug);
    const [english, french] =
      own.length === 0
        ? (GROUPS[name] ?? [name, name])
        : [site.pages.get(`en:${route}`).title, site.pages.get(`fr:${route}`).title];

    return [{ label: english, translations: { fr: french }, collapsed: true, items: [...own, ...nested] }];
  });
}

function byExampleOrder(a, b) {
  const rank = (name) => (EXAMPLE_ORDER.includes(name) ? EXAMPLE_ORDER.indexOf(name) : EXAMPLE_ORDER.length);

  return rank(a) - rank(b) || a.localeCompare(b);
}

function group(key, items, collapsed = false) {
  const [label, french] = GROUPS[key];

  return { label, translations: { fr: french }, collapsed, items };
}

function slug(route) {
  return { slug: route };
}

function under(routes, prefix) {
  return routes.filter((route) => route.startsWith(prefix)).sort();
}

/** The routes of the pages linked from the section `heading` of `file` (`## Tools: one page per decision` for `Tools`), in order. */
function indexed(root, file, heading) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  const section = sectionsOf(text).find((candidate) => candidate.heading.split(':')[0] === heading);

  return section === undefined ? [] : linkedRoutes(file, section.text);
}

/** The numbered sections of a reading path (`## 1. Strategic design: ...`): the label, and the routes linked in order. */
function numberedSections(root, file) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');

  return sectionsOf(text)
    .filter(({ heading }) => /^\d+\.\s/.test(heading))
    .map(({ heading, text: body }) => ({
      label: heading.replace(/^\d+\.\s+/, '').replace(/\s*:.*$/, ''),
      routes: linkedRoutes(file, body),
    }));
}

function sectionsOf(text) {
  return text
    .split(/^## /m)
    .slice(1)
    .map((part) => {
      const newline = part.indexOf('\n');
      return { heading: part.slice(0, newline).trim(), text: part.slice(newline + 1) };
    });
}

/** The routes of the pages a text links to, in order: a link to a directory leads to its README. */
function linkedRoutes(file, text) {
  const targets = [...text.matchAll(/\]\(([^)#\s:]+)(?:#[^)]*)?\)/g)].map((match) =>
    path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1])).replace(/\.fr\.md$/, '.md'),
  );
  const routes = targets.map((target) => routeOf(target.endsWith('.md') ? target : `${target}/README.md`));

  return [...new Set(routes.filter((route) => route !== undefined))];
}

function architectureId(root, source) {
  return /^Architecture id: `([^`]+)`/m.exec(fs.readFileSync(path.join(root, source), 'utf8'))?.[1];
}
