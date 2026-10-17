import type { Remaining } from '../progress/remaining.js';
import { storyOf } from './story-of.js';
import type { StoryClosing, StoryMarker } from './story-closing.js';

const MARK: Readonly<Record<Remaining['kind'], string>> = {
  review: 'TODO(review)',
  domain: 'TODO(domain)',
  platform: 'TODO(platform)',
  test: 'it.todo',
};

const ORDER: readonly Remaining['kind'][] = ['review', 'domain', 'platform', 'test'];

/**
 * `story-check` for a reader: a first line that says whether the story can close; then the rows
 * and the markers of its own that keep it open, each with why it is its own and the fix; then the
 * markers that may be its own, listed without blocking.
 */
export function formatStoryClosing(closing: StoryClosing): string {
  return [
    verdictLine(closing),
    ...openLines(closing),
    ...ownLines(closing),
    ...notBlocking(closing),
    ...notes(closing),
  ].join('\n');
}

function verdictLine({ story, rows, open, markers, contexts, canClose }: StoryClosing): string {
  if (canClose) {
    return `${story} can close: its ${plural(rows.length, 'row')} done, no marker of its own left${contexts.length === 0 ? '' : ` in ${contexts.join(', ')}`}.`;
  }

  const left = open.length === 0 ? 'every row done' : `${plural(open.length, 'row')} not done`;

  return `${story} cannot close: ${left}, ${plural(markers.length, 'marker')} of its own left.`;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function openLines({ open }: StoryClosing): string[] {
  if (open.length === 0) {
    return [];
  }

  return [
    '',
    'Rows not done (the conductor marks a row done when its branch merges)',
    ...open.map((row) => `  #${row.id} ${row.context} "${row.slice}": ${row.status}`),
  ];
}

function ownLines({ markers }: StoryClosing): string[] {
  return ORDER.flatMap((kind) => {
    const ofKind = markers.filter((marker) => marker.kind === kind);
    const [first] = ofKind;

    return first === undefined
      ? []
      : ['', `${MARK[kind]} (${ofKind.length}): ${first.fix}`, ...ofKind.map((marker) => markerLine(marker, ''))];
  });
}

function markerLine(marker: StoryMarker, mark: string): string {
  return `  ${marker.file}:${marker.line}  ${mark}${marker.text}  (${marker.why})`;
}

function notBlocking({ unattributed, others }: StoryClosing): string[] {
  const listed =
    unattributed.length === 0
      ? []
      : [
          '',
          `Not blocking, unattributed (${unattributed.length}): settle each, or name its row in the marker (\`TODO(review): #<row> <remark>\`)`,
          ...unattributed.map((marker) => markerLine(marker, `${MARK[marker.kind]}  `)),
        ];

  const owners = [
    ...new Set(others.flatMap((marker) => marker.attribution.rows.map((id) => storyOf(id) ?? id))),
  ].sort();

  const counted =
    others.length === 0
      ? []
      : [
          '',
          `Not blocking: ${plural(others.length, 'marker')} of these contexts ${others.length === 1 ? 'belongs' : 'belong'} to rows of ${owners.join(', ')}.`,
        ];

  return [...listed, ...counted];
}

function notes({ story, canClose, strict, unread }: StoryClosing): string[] {
  if (canClose) {
    return [];
  }

  return [
    '',
    ...(strict ? ['--strict: every marker of its contexts keeps it open, whoever it belongs to.'] : []),
    ...(unread.length === 0
      ? []
      : [
          `Not a context of the project: ${unread.join(', ')}; a marker outside the contexts is its own only when attributed to one of its rows.`,
        ]),
    `Once each is settled: npx ddd-ts-kit story-check ${story}`,
  ];
}
