// The change reference of the regulated profile: a PreToolUse hook of Claude Code on the Edit and
// Write tools, registered in .claude/settings.json by `ddd-ts-kit init --agent-profile regulated`.
// An edit of a migration or of the containers of the project asks for a change reference: the
// person confirms, and the session records the reference as the trailer `Change: <id>` of the
// commit that holds the file. It asks, it does not block. Owned by the team: edit the paths below.
import { readFileSync } from 'node:fs';
import process from 'node:process';
import path from 'node:path';

// What reaches production otherwise than through the code: the migrations of the ORM, the containers.
const GATED = [/(^|\/)migrations\//, /^prisma\/migrations\//, /^docker\//, /^Dockerfile$/, /^docker-compose\.ya?ml$/];

function readInput() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return undefined;
  }
}

const input = readInput();
const file = input?.tool_input?.file_path;

if (input === undefined || !['Edit', 'Write'].includes(input.tool_name) || typeof file !== 'string') {
  process.exit(0);
}

const root = typeof input.cwd === 'string' ? input.cwd : process.cwd();
const relative = path.relative(root, path.resolve(root, file)).split(path.sep).join('/');

if (relative.startsWith('..') || !GATED.some((pattern) => pattern.test(relative))) {
  process.exit(0);
}

const reason = [
  `change-reference: ${relative} is a migration or part of the containers: a change of what reaches production carries a change reference.`,
  'Allow the edit with the reference in mind (the id of the change ticket or of the story), then record it as the trailer `Change: <id>` of the commit that holds this file: `git commit -m "<message>" -m "Change: <id>"`. The trailer is read by people in the history.',
].join(' ');

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: reason },
  }),
);
process.exit(0);
