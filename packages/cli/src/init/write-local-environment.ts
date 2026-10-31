import type { Workspace } from '../workspace';

const EXAMPLE = '.env.example';
const LOCAL = '.env';

/** The first line of `.env.example`, which asks for the copy `init` makes. */
const COPY_ASKED = /^# Copy to \.env:[^\n]*\n/;

const WRITTEN =
  '# The variables of this machine, written by init from .env.example (NODE_ENV=development among them): `npm run dev` and docker compose read it. Never commit it: git ignores it.\n';

/**
 * The `.env` a new project starts from, so that `npm run dev` runs before anyone copies the
 * example: the same variables, `NODE_ENV=development` first. A `.env` that exists is the team's,
 * kept even with --force, since it may hold secrets.
 */
export function writeLocalEnvironment(ws: Workspace): void {
  const example = ws.read(EXAMPLE);

  if (example === undefined || ws.exists(LOCAL)) {
    return;
  }

  ws.create(LOCAL, example.replace(COPY_ASKED, WRITTEN));
}
