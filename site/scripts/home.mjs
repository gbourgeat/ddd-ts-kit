/**
 * The home page of the site, in English and in French: the pitch of the root README as the hero, beside the logo,
 * a card per way in, and the diagram of the nine steps the README shows. The pitch, the diagram
 * and its description are read from README.md and README.fr.md; only the cards are written here.
 */
import fs from 'node:fs';
import path from 'node:path';
import { BASE, hrefOf, REPOSITORY, SITE } from './routes.mjs';

const WORKFLOW_DIAGRAM = /^!\[([^\]]+)\]\(\S*\/(ddd-ts-kit-workflow(?:\.fr)?\.svg)\)$/m;

/** A card per way in: its title, what the reader finds there, and the route (and heading) it leads to. */
const CARDS = {
  en: [
    {
      title: 'Start',
      text: 'The nine steps of a project, the quick start, the plugin and what is enforced.',
      route: 'start',
    },
    {
      title: 'Concepts',
      text: 'One page per idea, as a reading path: strategic and tactical design, architecture, messaging.',
      route: 'concepts',
    },
    {
      title: 'Guides',
      text: 'The methodology, the command for each moment, team work and parallel work.',
      route: 'guides/methodology',
    },
    {
      title: 'Packages',
      text: 'The CLI, the runtime packages and the ESLint plugin: what each gives and its limits.',
      route: 'start',
      anchor: 'packages',
    },
    {
      title: 'Rules',
      text: 'Every rule of the checker and the ESLint plugin: why it exists, what it reports, what to write.',
      route: 'packages/eslint-plugin',
      anchor: 'rules',
    },
    {
      title: 'Example',
      text: 'A scheduling application built with the kit from a statement of needs, by parallel workers.',
      route: 'example',
    },
  ],
  fr: [
    {
      title: 'Démarrer',
      text: "Les neuf étapes d'un projet, le démarrage rapide, le plugin et ce qui est imposé.",
      route: 'start',
    },
    {
      title: 'Concepts',
      text: 'Une page par idée, en parcours de lecture : conception stratégique et tactique, architecture, messagerie.',
      route: 'concepts',
    },
    {
      title: 'Guides',
      text: 'La méthodologie, la commande de chaque moment, le travail en équipe et en parallèle.',
      route: 'guides/methodology',
    },
    {
      title: 'Packages',
      text: "La CLI, les packages d'exécution et le plugin ESLint : ce que chacun apporte et ses limites.",
      route: 'start',
      anchor: 'packages',
    },
    {
      title: 'Règles',
      text: "Chaque règle du checker et du plugin ESLint : pourquoi elle existe, ce qu'elle signale, quoi écrire.",
      route: 'packages/eslint-plugin',
      anchor: 'règles',
    },
    {
      title: 'Exemple',
      text: "Une application de prise de rendez-vous construite avec le kit à partir d'une expression des besoins.",
      route: 'example',
    },
  ],
};

/**
 * The title a search engine shows for the home page: the name alone says nothing to someone who
 * looks for the subject, so it carries the words they type.
 */
const SEARCH_TITLES = {
  en: 'ddd-ts-kit: Domain-Driven Design and Clean Architecture for TypeScript',
  fr: 'ddd-ts-kit : Domain-Driven Design et Clean Architecture pour TypeScript',
};

const ACTIONS = {
  en: { start: 'Get started', source: 'View on GitHub' },
  fr: { start: 'Démarrer', source: 'Voir sur GitHub' },
};

/** The MDX of the home page in `locale`, from the root README of that language. */
export function homePage(root, locale) {
  const readme = fs.readFileSync(path.join(root, locale === 'fr' ? 'README.fr.md' : 'README.md'), 'utf8');
  const diagram = WORKFLOW_DIAGRAM.exec(readme);

  return [
    ...frontmatter(pitchOf(readme), locale),
    '',
    "import { CardGrid, LinkCard } from '@astrojs/starlight/components';",
    '',
    '<CardGrid>',
    ...CARDS[locale].map((card) => linkCard(card, locale)),
    '</CardGrid>',
    '',
    ...(diagram === null ? [] : [`![${diagram[1]}](${BASE}/diagrams/${diagram[2]})`, '']),
  ].join('\n');
}

/** The first paragraph after the title of the README, on one line. */
export function pitchOf(readme) {
  const afterTitle = readme.slice(readme.search(/^# /m)).split('\n').slice(1).join('\n');

  return (afterTitle.trim().split(/\n\s*\n/)[0] ?? '').replace(/\s+/g, ' ').trim();
}

/** The splash template of Starlight, the pitch as its tagline, and two actions: start, and the repository. */
function frontmatter(pitch, locale) {
  // The content file of the home page is index.mdx, or fr/index.mdx: one directory deeper.
  const logo = `${locale === 'fr' ? '../' : ''}../../../../docs/assets/logo.svg`;

  return [
    '---',
    'title: "ddd-ts-kit"',
    `description: ${JSON.stringify(pitch)}`,
    'template: splash',
    'editUrl: false',
    ...head(pitch, locale),
    'hero:',
    `  tagline: ${JSON.stringify(pitch)}`,
    '  image:',
    `    file: ${JSON.stringify(logo)}`,
    '    alt: ""',
    '  actions:',
    `    - text: ${JSON.stringify(ACTIONS[locale].start)}`,
    `      link: ${JSON.stringify(hrefOf('start', locale))}`,
    '      icon: right-arrow',
    `    - text: ${JSON.stringify(ACTIONS[locale].source)}`,
    `      link: ${JSON.stringify(REPOSITORY)}`,
    '      icon: external',
    '      variant: minimal',
    '---',
  ];
}

/** The title of the search result and of a shared link, and what the project is, as structured data. */
function head(pitch, locale) {
  const project = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareSourceCode',
    name: 'ddd-ts-kit',
    description: pitch,
    url: `${SITE}${hrefOf('', locale)}`,
    codeRepository: REPOSITORY,
    programmingLanguage: 'TypeScript',
    runtimePlatform: 'Node.js',
    license: 'https://opensource.org/licenses/MIT',
    keywords:
      'Domain-Driven Design, DDD, Clean Architecture, hexagonal architecture, ports and adapters, TypeScript, Node.js, CQRS, event sourcing, Claude Code, Codex, GitHub Copilot',
  };

  return [
    'head:',
    '  - tag: title',
    `    content: ${JSON.stringify(SEARCH_TITLES[locale])}`,
    '  - tag: meta',
    '    attrs:',
    '      property: og:title',
    `      content: ${JSON.stringify(SEARCH_TITLES[locale])}`,
    '  - tag: script',
    '    attrs:',
    '      type: application/ld+json',
    `    content: ${JSON.stringify(JSON.stringify(project))}`,
  ];
}

function linkCard({ title, text, route, anchor }, locale) {
  const href = `${hrefOf(route, locale)}${anchor === undefined ? '' : `#${anchor}`}`;

  return `  <LinkCard title=${JSON.stringify(title)} description=${JSON.stringify(text)} href=${JSON.stringify(href)} />`;
}
