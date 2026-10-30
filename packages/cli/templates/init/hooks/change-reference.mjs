// The change reference of the regulated profile: a PreToolUse hook of Claude Code on the Edit,
// Write and MultiEdit tools, registered in .claude/settings.json by `ddd-ts-kit init --agent-profile regulated`.
// An edit of a migration or of the containers of the project asks for a change reference: the
// person confirms, and the session records the reference as the trailer `Change: <id>` of the
// commit that holds the file. It asks, it does not block. Owned by the team: edit the paths below.
import { execFileSync } from 'node:child_process';
import { existsSync, readSync } from 'node:fs';
import path from 'node:path';

// What reaches production otherwise than through the code: the migrations of the ORM, the containers.
const GATED = [
  /(^|\/)migrations\//,
  /^prisma\/migrations\//,
  /(^|\/)docker\//,
  /(^|\/)Dockerfile$/,
  /(^|\/)docker-compose[\w.-]*\.ya?ml$/,
];

// Reads all of stdin. A writer that is late leaves the pipe empty for a moment, which answers EAGAIN: wait for it.
function readStdin() {
  const chunks = [];
  const buffer = Buffer.alloc(65536);

  for (;;) {
    try {
      const count = readSync(0, buffer, 0, buffer.length, null);

      if (count === 0) {
        return Buffer.concat(chunks).toString('utf8');
      }

      chunks.push(Buffer.from(buffer.subarray(0, count)));
    } catch (error) {
      if (error.code === 'EOF') {
        return Buffer.concat(chunks).toString('utf8');
      }

      if (error.code !== 'EAGAIN') {
        throw error;
      }

      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
  }
}

function readInput() {
  try {
    return JSON.parse(readStdin());
  } catch {
    return undefined;
  }
}

function ask(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: reason },
    }),
  );
  process.exit(0);
}

const contains = (outer, inner) => !path.relative(outer, inner).startsWith('..');

// The root of the checkout that holds the file, a worktree of the project included, so that the
// path is read from there whatever the directory the session works in. Falls back to that directory.
function checkoutOf(absolute, cwd) {
  let directory = path.dirname(absolute);

  while (!existsSync(directory) && path.dirname(directory) !== directory) {
    directory = path.dirname(directory);
  }

  try {
    const top = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: directory,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    return contains(top, cwd) || contains(cwd, top) ? top : cwd;
  } catch {
    return cwd;
  }
}

const input = readInput();
const file = input?.tool_input?.file_path;

if (input === undefined) {
  ask(
    'change-reference: the input of the hook could not be read, so the file cannot be judged. Allow the edit only if it is no migration and no part of the containers.',
  );
}

if (!['Edit', 'Write', 'MultiEdit'].includes(input.tool_name) || typeof file !== 'string') {
  process.exit(0);
}

const cwd = typeof input.cwd === 'string' ? input.cwd : process.cwd();
const absolute = path.resolve(cwd, file);
const root = checkoutOf(absolute, cwd);
const relative = path.relative(root, absolute).split(path.sep).join('/');

if (relative.startsWith('..') || !GATED.some((pattern) => pattern.test(relative))) {
  process.exit(0);
}

const reason = [
  `change-reference: ${relative} is a migration or part of the containers: a change of what reaches production carries a change reference.`,
  'Allow the edit with the reference in mind (the id of the change ticket or of the story), then record it as the trailer `Change: <id>` of the commit that holds this file: `git commit -m "<message>" -m "Change: <id>"`. The trailer is read by people in the history.',
].join(' ');

ask(reason);
