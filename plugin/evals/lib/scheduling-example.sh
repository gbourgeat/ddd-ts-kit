#!/usr/bin/env bash
# The fixture of every case: the scheduling example of the repository, copied into the empty
# workspace of the run, with the node_modules of the repository linked so that `npx ddd-ts-kit`
# is the CLI built in packages/cli/dist (`npm run build` first), and a git repository with one
# commit so that a case can plant a change and a session can diff or commit. Sourced by the
# fixture.sh of a case, which plants what the case needs after it.
set -euo pipefail

lib="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd "$lib/../../.." && pwd)"

if [ ! -f "$repo/packages/cli/dist/bin.js" ]; then
  echo "The CLI is not built: run \`npm run build\` at $repo first." >&2
  exit 1
fi

cp -R "$repo/examples/scheduling/." .
rm -rf node_modules .worktrees .ddd-ts-kit
ln -s "$repo/node_modules" node_modules

git init --quiet --initial-branch main
git -c user.name=Eval -c user.email=eval@example.com -c commit.gpgsign=false add --all
git -c user.name=Eval -c user.email=eval@example.com -c commit.gpgsign=false commit --quiet --message 'chore: the scheduling example'
