#!/usr/bin/env bash
# The scheduling example, then what this case plants. Runs with `--scaffold` only.
set -euo pipefail
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../lib/scheduling-example.sh"
mkdir -p .ddd-ts-kit docs/architecture/stories test/acceptance
printf '{"story":"US9","base":"main","branch":"story/us9"}\n' > .ddd-ts-kit/story.json
cat > docs/architecture/stories/US9.md <<'STORY'
# US9 Clear a waitlist

## Acceptance criteria

- AC1: a practice owner clears the waitlist of a day and the API answers that it was created cleared

## Decisions

## Report
STORY
cat > test/acceptance/us9.acceptance.spec.ts <<'SPEC'
import { describe, it } from 'vitest';
import { expectStatus } from '@ddd-ts-kit/testing/e2e';

describe('US9, acceptance', () => {
  it('#US9.01 AC1 a practice owner clears the waitlist of a day', async () => {
    const response = { status: 200, headers: {}, body: undefined };

    expectStatus(response, 201);
  });
});
SPEC
cat > docs/architecture/slices.md <<'SLICES'
# Slices

| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |
|---|---|---|---|---|---|---|---|
| US9.01 | scheduling | slice | Clear a waitlist | `command scheduling ClearWaitlist --aggregate Waitlist --permission waitlist.clear` | | scheduling | done |
SLICES
# The lock as the CLI writes it: the fingerprints of the criterion and of the scenario.
npx --no -- ddd-ts-kit acceptance US9 --lock > /dev/null
git -c user.name=Eval -c user.email=eval@example.com -c commit.gpgsign=false add --all
git -c user.name=Eval -c user.email=eval@example.com -c commit.gpgsign=false commit --quiet --message 'test(acceptance): US9 locked'
