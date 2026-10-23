import fs from 'node:fs';
import path from 'node:path';
import { expect } from 'vitest';
import type { MeasuresView } from '../../src/measures/measures-view.js';
import type { StoryMeasures } from '../../src/measures/story-measures.js';
import { cli, tempDir } from '../helpers.js';
import { commitFiles } from './commit-files.js';
import { git } from './git.js';

export const US5 = 'docs/architecture/stories/US5.md';
const US6 = 'docs/architecture/stories/US6.md';
const ORDER = 'src/contexts/ordering/order.ts';

const SLICES = `# Slices

| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |
|---|---|---|---|---|---|---|---|
| US5.01 | ordering | slice | Place order | | | ordering | done |
| US5.02 | ordering | slice | Settle | | | ordering | done |
| US6.01 | billing | slice | Fix | | | billing | todo |
`;

const STATEMENT = `# US5 Order

## Statement

A customer places an order.

## Acceptance criteria

- AC1: a customer places an order
- AC2: the order is invoiced

## Decisions

## Report
`;

const REPORTED = `# US5 Order

## Origin

Ticket SHOP-12.

## Statement

A customer places an order.

## Acceptance criteria

- AC1: a customer places an order
- AC2: the order is invoiced to its customer

## Decisions

- D1 (provisional): round half up. Why: simplest.
- **D2** (provisional): one currency.

## Report

The story delivers orders.

### Compromises

- the total is not rounded by the aggregate
- no currency

### Verification

- \`npm run verify\` ends with verify: ok
`;

const LOCK = JSON.stringify({
  story: 'US5',
  criteria: {},
  scenarios: [],
  amendments: [{ subject: 'criterion AC1', criteria: ['AC1'], reason: 'r', verdict: 'v.md', on: '2026-03-02' }],
});

const INCIDENT = (title: string, message: string): string =>
  `---\nmessage: ${message}\nerror_code: SLOT_TAKEN\n---\n# ${title}\n`;

const US6_STORY = `# US6 Fix

## Origin

Incident docs/architecture/incidents/inc-2.md.

## Acceptance criteria

- AC1: a slot is held once

## Decisions

## Report
`;

const US6_REVIEW = `# US6 review

## #US6.01 Fix

the aggregate

## Findings

### bugs

- language/glossary-term: name the total after its term
- a replay that is not idempotent

### security

- a search not narrowed by the scope
`;

const REFUSAL = `Story: US6
Subject: criterion AC1
Fingerprint: abc
Verdict: refuse
Reason: not what the owner said
`;

export const STATEMENT_OF_US5 = STATEMENT;

/** The measures of the repository as JSON, the command having succeeded. */
export function measuresOf(root: string, ...args: string[]): MeasuresView {
  const result = cli(root, 'measures', '--json', ...args);

  expect(result.code, result.stderr).toBe(0);

  return result.json() as MeasuresView;
}

/** The measures of one story of the view, which must be there. */
export function storyOf(view: MeasuresView, code: string): StoryMeasures {
  const found = view.stories.find((candidate) => candidate.story === code);

  if (found === undefined) {
    throw new Error(`${code} is not measured`);
  }

  return found;
}

/**
 * A repository where US5 is built on its branch, one commit per phase at a known instant, and
 * merged on main; US6 is opened on main meanwhile, from an incident that repeats an earlier one,
 * with a review file holding findings and a refused verdict. Answers the root.
 */
export function measuredStories(): string {
  const root = path.join(fs.realpathSync(tempDir('measures')), 'shop');

  const at = (instant: string, message: string, files: Readonly<Record<string, string>>): string =>
    commitFiles(root, { message, files, at: instant });

  fs.mkdirSync(root);
  git(root, 'init', '--quiet', '--initial-branch', 'main');

  at('2026-03-01T09:00:00Z', 'chore: bootstrap', {
    'ddd-ts-kit.config.json': '{}\n',
    'docs/architecture/slices.md': SLICES,
    [US5]: STATEMENT,
  });

  git(root, 'switch', '--quiet', '--create', 'story/us5');

  at('2026-03-02T09:00:00Z', 'test(acceptance): US5 locked', {
    'test/acceptance/us5.acceptance.lock.json': LOCK,
    'test/acceptance/us5.acceptance.spec.ts': '// spec\n',
  });

  at('2026-03-03T09:00:00Z', 'feat(ordering): place order\n\nSlice: US5.01', {
    [ORDER]:
      'export const order = 1;\n// TODO(review): #US5.01 name the total after its term (language/glossary-term)\n',
  });

  at('2026-03-03T11:00:00Z', 'docs(story): US5 criteria', {
    [US5]: STATEMENT.replace('the order is invoiced', 'the order is invoiced to its customer'),
  });

  at('2026-03-04T09:00:00Z', 'feat(ordering): settle the review\n\nSlice: US5.02', {
    [ORDER]: 'export const order = 1;\n',
  });

  at('2026-03-05T09:00:00Z', 'docs(story): US5 report', { [US5]: REPORTED });

  git(root, 'switch', '--quiet', 'main');

  at('2026-03-02T12:00:00Z', 'docs(incidents): inc-1', {
    'docs/architecture/incidents/inc-1.md': INCIDENT('INC-1', 'Slot already taken'),
  });

  at('2026-03-03T15:00:00Z', 'docs(story): US6 opened', {
    'docs/architecture/incidents/inc-2.md': INCIDENT('INC-2', 'Slot taken again'),
    'docs/architecture/incidents/notes.md': '# Not a record\n',
    [US6]: US6_STORY,
    'docs/architecture/reviews/US6.md': US6_REVIEW,
    'test/acceptance/verdicts/us6-ac1.md': REFUSAL,
  });

  mergeAt(root, '2026-03-06T09:00:00Z', 'story/us5');

  return root;
}

/** Merges the branch with a merge commit dated at the instant, as a pull request would. */
function mergeAt(root: string, instant: string, branch: string): void {
  const dates = { GIT_AUTHOR_DATE: instant, GIT_COMMITTER_DATE: instant };

  for (const [key, value] of Object.entries(dates)) {
    process.env[key] = value;
  }

  try {
    git(root, 'merge', '--quiet', '--no-ff', '--no-edit', branch);
  } finally {
    for (const key of Object.keys(dates)) {
      Reflect.deleteProperty(process.env, key);
    }
  }
}
