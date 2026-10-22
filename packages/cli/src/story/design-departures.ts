import { storyFileOf } from '../acceptance/story-file-of.js';
import type { Project } from '../check/model/project.js';
import { loadProject } from '../check/project/load-project.js';
import { escapeRegExp } from '../check/text/escape-reg-exp.js';
import type { CitedName } from '../citations/cited-name.js';
import { type DesignedProject, citedParts } from '../citations/cited-parts.js';
import type { DocumentPart } from '../citations/document-part.js';
import { indexOfProject } from '../citations/index-of-project.js';
import type { NameIndex } from '../citations/name-index.js';
import { partsOfDocument } from '../citations/parts-of-document.js';
import type { Config } from '../config/index.js';
import type { Slice } from '../progress/slice.js';
import { reviewFileOf } from '../stories/review-file-of.js';
import { Workspace } from '../workspace/index.js';
import { compromisesIn } from './compromises-in.js';
import type { DesignDeparture } from './design-departure.js';
import { storyOf } from './story-of.js';

/** A name cited by the section of a done row, with the row and the contexts it is read in. */
interface Cited {
  readonly row: string;
  readonly part: DocumentPart;
  readonly contexts: readonly string[];
  readonly name: CitedName;
}

/** What the working tree has: the names declared or imported by its sources, and its files. */
interface Tree {
  readonly config: Config;
  readonly project: Project;
  readonly index: NameIndex;
  readonly imported: ReadonlySet<string>;
}

/**
 * The names the design review of a story cites, in the section of each done row, that the code
 * does not have and that `### Compromises` of its `## Report` does not list: a path under the
 * source root or relative to a context must exist, a PascalCase name must be declared by a
 * source or imported by one, a `Class.member` must be named in a file declaring the class. A
 * name whose sentence records its removal is history, not design. The tree is read only when a
 * section cites a name.
 */
export function designDepartures(
  { root, config }: DesignedProject,
  story: string,
  rows: readonly Slice[],
): DesignDeparture[] {
  const ws = new Workspace(root, false);
  const review = reviewFileOf(ws, story);
  const done = rows.filter((row) => storyOf(row.id) === story && row.status === 'done').map((row) => row.id);

  if (review === undefined || done.length === 0) {
    return [];
  }

  const cited = citedInSections(review, ws.read(review) ?? '', { rows, done, root, config });
  const excused = compromisesIn(ws.read(storyFileOf(ws, story) ?? '') ?? '');
  const judged = cited.filter(({ name }) => !name.recorded && !excused.has(name.cited));

  if (judged.length === 0) {
    return [];
  }

  const tree = treeOf(root, config);

  return judged.flatMap((citation): DesignDeparture[] => {
    const why = missing(citation, tree);

    return why === undefined ? [] : [departure(citation, why, story)];
  });
}

interface Sections {
  readonly rows: readonly Slice[];
  readonly done: readonly string[];
  readonly root: string;
  readonly config: Config;
}

/** Each name the sections of the done rows cite, once per section it lies in. */
function citedInSections(review: string, text: string, sections: Sections): Cited[] {
  const ids = [...new Set(sections.rows.map((row) => row.id))];

  const parts = partsOfDocument({ path: review, text }, ids, []).filter(
    (part) => part.section !== undefined && part.rows.some((id) => sections.done.includes(id)),
  );

  return citedParts(parts, sections.rows, { root: sections.root, config: sections.config }).flatMap(
    ({ part, contexts, names }) => {
      const row = part.rows.find((id) => sections.done.includes(id)) ?? '';

      return names.map((name) => ({ row, part, contexts, name }));
    },
  );
}

function treeOf(root: string, config: Config): Tree {
  const project = loadProject(root);
  const imported = new Set(project.files.flatMap((file) => file.imports.flatMap((record) => record.names)));

  return { config, project, index: indexOfProject(project), imported };
}

/** Why the code lacks the name; undefined when it has it. */
function missing({ name, contexts }: Cited, tree: Tree): string | undefined {
  if (name.kind === 'path') {
    return missingPath(name.cited, contexts, tree);
  }

  if (name.kind === 'member') {
    return missingMember(name.cited, tree);
  }

  return missingSymbol(name.cited, tree);
}

function missingPath(cited: string, contexts: readonly string[], { index, config }: Tree): string | undefined {
  const relative = !cited.startsWith(`${config.sourceRoot}/`);
  const places = relative ? contexts.map((context) => `${config.contextsDir}/${context}/${cited}`) : [cited];
  const files = [...index.files];

  const present = places.some(
    (place) => index.files.has(place) || (place.endsWith('/') && files.some((file) => file.startsWith(place))),
  );

  if (present) {
    return undefined;
  }

  return relative
    ? `no ${cited} under ${contexts.map((context) => `${config.contextsDir}/${context}/`).join(' or ')}`
    : `no ${cited}`;
}

function missingSymbol(cited: string, { index, imported }: Tree): string | undefined {
  return index.names.has(cited) || imported.has(cited)
    ? undefined
    : `no class, interface, type or function ${cited} is declared or imported under the source root`;
}

function missingMember(cited: string, tree: Tree): string | undefined {
  const [owner = '', member = ''] = cited.split('.');
  const files = tree.index.names.get(owner);

  if (files === undefined) {
    return missingSymbol(owner, tree);
  }

  const named = new RegExp(`(?<![\\w$])${escapeRegExp(member)}(?![\\w$])`);

  const declaring = files.filter((file) =>
    named.test(tree.project.files.find((source) => source.path === file)?.scan.code ?? ''),
  );

  return declaring.length > 0 ? undefined : `${owner} (${files.join(', ')}) has no member ${member}`;
}

function departure({ row, part, name }: Cited, why: string, story: string): DesignDeparture {
  return {
    row,
    document: part.document,
    line: name.line,
    cited: name.cited,
    kind: name.kind,
    why,
    fix: `update the section of #${row} in ${part.document} to what the row built, or list \`${name.cited}\` under \`### Compromises\` of \`## Report\` in docs/architecture/stories/${story}.md with why`,
  };
}
