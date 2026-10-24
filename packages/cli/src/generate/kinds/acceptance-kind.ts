import { acceptanceFileOf } from '../../acceptance/acceptance-file-of';
import { criteriaIn } from '../../acceptance/criteria-in';
import { storyFileOf } from '../../acceptance/story-file-of';
import { storyOfRow } from '../../acceptance/story-of-row';
import { CliError } from '../../cli-error';
import type { Config } from '../../config';
import { readSlices, SLICES_FILE } from '../../progress/read-slices';
import type { Slice } from '../../progress/slice';
import { stackVars } from '../../stack/stack-vars';
import { renderTemplate } from '../../templating';
import type { Workspace } from '../../workspace';
import type { Kind } from '../kind';

const STORY = /^[A-Za-z0-9][A-Za-z0-9-]*$/;

export const acceptanceKind: Kind = {
  name: 'acceptance',
  aliases: [],
  usage: 'acceptance <story> ["<title>"]',
  summary:
    'The acceptance spec of a story, in test/acceptance/, written before its code: an it.todo per acceptance criterion of docs/architecture/stories/<story>.md, or per slice row of the story in docs/architecture/slices.md when it states none.',
  positionals: ['story'],
  optionalPositionals: ['title'],
  writesShared: true,
  run: ({ ws, config, args }) => {
    const story = storyNamed(args[0] ?? '');

    requireHttp(config);

    const rows = slicesOf(readSlices(ws) ?? [], story);

    ws.create(
      acceptanceFileOf(story),
      renderTemplate('acceptance/acceptance.spec.ts.tpl', {
        ...stackVars(config),
        story: {
          id: story,
          title: quoted(args[1]?.trim() || story),
          example: `${story}.01`,
          rows: rows.map((row) => `#${row.id} ${row.slice}`).join(', '),
          todos: todosOf(ws, story, rows).join('\n'),
        },
      }),
    );

    if (!ws.exists('test/e2e/support/start-application.ts')) {
      ws.note(
        'test/e2e/support/start-application.ts is missing: `ddd-ts-kit init` creates it (existing files are kept).',
      );
    }
  },
};

function storyNamed(story: string): string {
  if (!STORY.test(story)) {
    throw new CliError(
      `"${story}" is not the code of a story.`,
      'Pass the code its rows start with in docs/architecture/slices.md: `US5` for the rows `US5.01`, `US5.02`.',
    );
  }

  return story;
}

function requireHttp(config: Config): void {
  if (config.stack.http === 'none') {
    throw new CliError(
      'The project has no HTTP stack: an acceptance scenario drives the application through its API.',
      'Write the acceptance of the story as specs of its handlers in each context (skill ddd-ts-kit:testing).',
    );
  }
}

/** An it.todo per acceptance criterion the specification of the story states, else per slice row. */
function todosOf(ws: Workspace, story: string, rows: readonly Slice[]): string[] {
  const specification = storyFileOf(ws, story);
  const criteria = specification === undefined ? [] : criteriaIn(ws.read(specification) ?? '');

  return criteria.length > 0
    ? criteria.map((criterion) => `  it.todo('${criterion.id} ${quoted(criterion.text)}');`)
    : rows.map((row) => `  it.todo('#${row.id} ${quoted(asARule(row.slice))}');`);
}

/** The title of a slice read as the rule its scenario will state: `Place order` as `place order`. */
function asARule(slice: string): string {
  return slice.charAt(0).toLowerCase() + slice.slice(1);
}

/** The slice rows of the story, which a client can observe; contracts and skeletons are proved through them. */
function slicesOf(slices: readonly Slice[], story: string): Slice[] {
  const own = slices.filter((row) => storyOfRow(row.id).toLowerCase() === story.toLowerCase());

  if (own.length === 0) {
    throw new CliError(
      `No row of ${SLICES_FILE} belongs to ${story}.`,
      `Plan the story first (skill ddd-ts-kit:plan-slices), its rows numbered ${story}.01, ${story}.02: each scenario names the row that makes it pass.`,
    );
  }

  const slicesOnly = own.filter((row) => row.kind === 'slice');

  return slicesOnly.length > 0 ? slicesOnly : own;
}

/** A text safe between the single quotes of a test title. */
function quoted(text: string): string {
  return text.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
}
