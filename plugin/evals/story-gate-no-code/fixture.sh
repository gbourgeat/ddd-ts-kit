#!/usr/bin/env bash
# The scheduling example, then what this case plants. Runs with `--scaffold` only.
set -euo pipefail
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../lib/scheduling-example.sh"
mkdir -p .ddd-ts-kit docs/architecture/stories
printf '{"story":"US9","base":"main","branch":"story/us9"}\n' > .ddd-ts-kit/story.json
cat > docs/architecture/slices.md <<'SLICES'
# Slices

| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |
|---|---|---|---|---|---|---|---|
| US9.01 | scheduling | slice | Clear a waitlist | `command scheduling ClearWaitlist --aggregate Waitlist --permission waitlist.clear` | | scheduling | todo |
SLICES
cat > docs/architecture/stories/US9.md <<'STORY'
# US9 Clear a waitlist

## Statement

A practice clears the waitlist of a day.

## Questions

- Who may clear it: the practice owner, by the owner.

## Acceptance criteria

- AC1: a practice owner clears the waitlist of a day and reads it empty

## Decisions

## Report
STORY
git -c user.name=Eval -c user.email=eval@example.com -c commit.gpgsign=false add --all
git -c user.name=Eval -c user.email=eval@example.com -c commit.gpgsign=false commit --quiet --message 'docs(story): US9 opened'
