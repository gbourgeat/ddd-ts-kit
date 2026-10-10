import fs from 'node:fs';
import path from 'node:path';
import { runCheck } from '../src/check/engine/run-check.js';
import { loadProject } from '../src/check/project/load-project.js';
import { tempDir } from './helpers.js';

export interface Reported {
  readonly file: string;
  readonly line: number;
  readonly message: string;
}

/** A project of two contexts, shipping downstream of billing, holding the files given. */
export function projectWith(files: Readonly<Record<string, string>>, config: Record<string, unknown> = {}): string {
  const root = tempDir('rules');
  const contexts = { billing: { classification: 'core', upstreams: [] }, shipping: { classification: 'supporting', upstreams: ['billing'] } };
  const written = { 'ddd-ts-kit.config.json': JSON.stringify({ contexts, ...config }, null, 2), ...files };

  for (const [file, content] of Object.entries(written)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  }

  return root;
}

/** What one rule reports in a project, or in one of its files the way `check-file` reads it. */
export function reported(root: string, rule: string, onlyFile?: string): Reported[] {
  const project = onlyFile === undefined ? loadProject(root) : loadProject(root, { onlyFile });
  const { violations } = runCheck(project, { rules: [rule], fileScopeOnly: onlyFile !== undefined });

  return violations.map(({ file, line, message }) => ({ file, line, message }));
}

/** A source written line by line, ending with a newline. */
export function lines(...written: string[]): string {
  return `${written.join('\n')}\n`;
}
