import { spawnSync } from 'node:child_process';
import { CliError } from '../../cli-error';
import type { GuardedOrm } from './guarded-text';

/**
 * The statements of the guard, from the `@ddd-ts-kit/audit` the project installed: the same that
 * `npm run db:audit-guard` prints and that the in-process database of the tests runs.
 */
export function auditGuardStatementsOf(root: string, orm: GuardedOrm): (schema: string) => string[] {
  return (schema) => {
    const script = `import { auditGuardStatements } from '@ddd-ts-kit/audit/${orm}'; process.stdout.write(JSON.stringify(auditGuardStatements(${JSON.stringify(schema)})));`;
    const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: root, encoding: 'utf8' });
    const statements: unknown = run.status === 0 ? JSON.parse(run.stdout) : undefined;

    if (!Array.isArray(statements) || !statements.every((statement) => typeof statement === 'string')) {
      throw new CliError(
        `The statements of the audit guard could not be read from @ddd-ts-kit/audit/${orm}.`,
        `Run \`npm install\` in the project, then \`npm run db:audit-guard\` to see them: ${run.stderr.trim()}`,
      );
    }

    return statements;
  };
}
