import { spawnSync } from 'node:child_process';
import { ormToolEntry } from './audit-guard/orm-tool-entry';
import { toolStdio } from './tool-stdio';
import type { ToolStep } from './tool-step';

/** The variable that carries the steps to the process that serves the database. */
const STEPS_VARIABLE = 'DDD_TS_KIT_IN_PROCESS_STEPS';

/**
 * Starts PostgreSQL in process (PGlite, served over the wire protocol by pglite-socket, as the
 * tests of the project do), runs each step against it and stops at the first one that fails. It is
 * a process of its own, started in the project, so that it uses the PGlite the project installed.
 */
const SERVER = `const { spawn } = require('node:child_process');
(async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const { PGLiteSocketServer } = await import('@electric-sql/pglite-socket');
  const engine = await PGlite.create();
  const server = new PGLiteSocketServer({ db: engine, host: '127.0.0.1', port: 0, maxConnections: 10 });
  await server.start();
  const url = 'postgresql://postgres:postgres@' + server.getServerConn() + '/postgres';
  const put = (text) => text.split('{url}').join(url);
  let code = 0;
  for (const step of JSON.parse(process.env.${STEPS_VARIABLE})) {
    const env = { ...process.env };
    for (const [name, value] of Object.entries(step.env)) env[name] = put(value);
    code = await new Promise((resolve) => {
      const child = spawn(process.execPath, [step.entry, ...step.args.map(put)], { stdio: 'inherit', env });
      child.on('error', () => resolve(1));
      child.on('exit', (status) => resolve(status ?? 1));
    });
    if (code !== 0) break;
  }
  await server.stop();
  await engine.close();
  process.exit(code);
})().catch((error) => {
  console.error('The in-process database could not start: ' + (error && error.message ? error.message : error));
  console.error('Set DATABASE_URL to a reachable database, or install @electric-sql/pglite and @electric-sql/pglite-socket.');
  process.exit(1);
});`;

/**
 * Runs the tools of an ORM, in the project, against a PostgreSQL started in process and empty: the
 * same engine the tests of the project run on, so that a migration is generated with no server
 * reachable (the sandbox of an agent). Answers the exit code of the first step that fails, else 0.
 */
export function runOnInProcessDatabase(root: string, steps: readonly ToolStep[]): number {
  const resolved = steps.map((step) => ({
    entry: ormToolEntry(root, step.bin),
    args: step.args,
    env: step.env ?? {},
  }));

  return (
    spawnSync(process.execPath, ['-e', SERVER], {
      cwd: root,
      stdio: toolStdio(),
      env: { ...process.env, [STEPS_VARIABLE]: JSON.stringify(resolved) },
    }).status ?? 1
  );
}
