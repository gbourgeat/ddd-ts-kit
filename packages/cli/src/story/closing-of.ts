import type { Remaining } from '../progress/remaining';
import type { Slice } from '../progress/slice';
import type { AttributedMarker, MarkerAttribution } from './attributed-marker';
import type { OpenRow, StoryClosing, StoryMarker } from './story-closing';
import { storyOf } from './story-of';
import type { StoryPlan } from './story-plan';
import { type StoryScope, storyScope } from './story-scope';

const ADR = '`npx ddd-ts-kit generate adr "<title>"`';

const FIXES: Readonly<Record<Remaining['kind'], string>> = {
  domain: `write the business decision it asks for, or dismiss it by a decision record (${ADR}), then delete the marker`,
  platform: `make the technical choice it asks for, or dismiss it by a decision record (${ADR}), then delete the marker`,
  test: `write the test, or dismiss it by a decision record (${ADR}), then delete the it.todo`,
  review: `handle it in a slice, or dismiss it by a decision record (${ADR}, quoting the remark without its marker), then delete the marker in the same commit`,
};

interface Verdict {
  readonly kind: 'own' | 'unattributed' | 'other' | 'none';
  readonly why: string;
  readonly sharedWith: readonly string[];
}

/**
 * Whether a story or a milestone can close: every row of it done, no marker of its own left, no
 * done row departed from its design review without the report saying so (`plan.design`), and,
 * under the regulated profile or with `strict`, no commit of it changing a migration or a
 * container without its `Change:` trailer (`plan.unreferenced`, listed without blocking otherwise).
 * A marker is its own when the rows it belongs to (its text, the commit that wrote it, the worker
 * that holds it uncommitted) include one of its rows, wherever it is; a marker of its contexts that
 * belongs to no row is its own when no other open story has a row in that context, and is listed
 * without blocking otherwise. With `strict`, every marker of its contexts is its own.
 */
export function closingOf(story: string, plan: StoryPlan, strict = false): StoryClosing {
  const scope = storyScope(story, plan.rows, plan.contexts);
  const open = plan.rows.filter((row) => storyOf(row.id) === story && row.status !== 'done').map(openRow);

  const judged = plan.markers.map((marker) => ({
    marker,
    verdict: verdictOf(marker, scope, { rows: plan.rows, strict }),
  }));

  const of = (kind: Verdict['kind']): StoryMarker[] =>
    judged.filter(({ verdict }) => verdict.kind === kind).map(({ marker, verdict }) => storyMarker(marker, verdict));

  const markers = of('own');
  const design = plan.design ?? [];
  const unreferenced = plan.unreferenced ?? [];
  const regulated = plan.regulated === true;
  const closable = open.length === 0 && markers.length === 0 && design.length === 0;

  return {
    story,
    rows: scope.ids,
    contexts: scope.contexts,
    unread: scope.unread,
    strict,
    open,
    markers,
    unattributed: of('unattributed'),
    others: judged.filter(({ verdict }) => verdict.kind === 'other').map(({ marker }) => marker),
    design,
    unreferenced,
    regulated,
    canClose: closable && (unreferenced.length === 0 || !(strict || regulated)),
  };
}

function openRow({ id, context, slice, status }: Slice): OpenRow {
  return { id, context, slice, status };
}

function storyMarker(marker: AttributedMarker, { why, sharedWith }: Verdict): StoryMarker {
  return { ...marker, why, sharedWith, fix: FIXES[marker.kind] };
}

function verdictOf(
  marker: AttributedMarker,
  scope: StoryScope,
  around: { readonly rows: readonly Slice[]; readonly strict: boolean },
): Verdict {
  const own = marker.attribution.rows.filter((id) => scope.ids.includes(id));
  const inContext = scope.contexts.includes(marker.context);
  const sharedWith = inContext ? openStoriesIn(marker.context, scope.story, around.rows) : [];

  if (own.length > 0) {
    return { kind: 'own', why: attributionWhy(marker.attribution, own), sharedWith };
  }

  if (!inContext) {
    return { kind: 'none', why: '', sharedWith };
  }

  if (around.strict) {
    return { kind: 'own', why: `in ${marker.context}, --strict`, sharedWith };
  }

  if (marker.attribution.rows.length > 0) {
    return { kind: 'other', why: '', sharedWith };
  }

  return sharedWith.length === 0
    ? { kind: 'own', why: `no other open story in ${marker.context}`, sharedWith }
    : {
        kind: 'unattributed',
        why: `unattributed, may belong to open ${sharedWith.join(', ')}: settle it or name the row in the marker`,
        sharedWith,
      };
}

function attributionWhy(attribution: MarkerAttribution, own: readonly string[]): string {
  const ids = own.map((id) => `#${id}`).join(', ');
  const { commit } = attribution;

  if (attribution.by === 'commit' && commit !== undefined) {
    return commit.trailer
      ? `written by ${commit.sha} Slice: ${own.join(', ')}`
      : `written by ${commit.sha}, whose message names ${ids}`;
  }

  return attribution.by === 'worker' ? `not committed, in the worktree of ${ids}` : `names ${ids}`;
}

/** The other stories with a row not done in the context. */
function openStoriesIn(context: string, story: string, rows: readonly Slice[]): string[] {
  const stories = rows
    .filter((row) => row.context === context && row.status !== 'done')
    .map((row) => storyOf(row.id))
    .filter((code): code is string => code !== undefined && code !== story);

  return [...new Set(stories)].sort();
}
