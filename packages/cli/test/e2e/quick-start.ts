import { read, REPO_ROOT } from '../helpers.js';
import type { Manager } from './install-for-real.js';

/** What the README says of npm: the same lines, in its words. */
const ON_NPM: readonly (readonly [RegExp, string])[] = [
  [/^npx ddd-ts-kit init\b/, 'npx ddd-ts-kit init --package-manager npm'],
  [/^pnpm exec /, 'npx '],
  [/^pnpm (install|run)\b/, 'npm $1'],
];

/**
 * The commands of the root README that an agent types for a new project (its section "What the
 * agent runs"), in order: every line of its `bash` blocks, a continued line joined and a trailing
 * comment removed, said for the package manager asked for. The agent types them; the suite runs them.
 */
export function quickStart(manager: Manager): string[] {
  const section = read(REPO_ROOT, 'README.md')
    .split(/^## /m)
    .find((part) => part.startsWith('What the agent runs'));

  const blocks = [...(section ?? '').matchAll(/```bash\n([\s\S]*?)```/g)].map((block) => block[1] ?? '');

  return blocks
    .join('')
    .replaceAll('\\\n', ' ')
    .split('\n')
    .map((line) =>
      line
        .replace(/\s+#\s.*$/, '')
        .replaceAll(/\s+/g, ' ')
        .trim(),
    )
    .filter((line) => line !== '')
    .map((line) => (manager === 'npm' ? onNpm(line) : line));
}

function onNpm(line: string): string {
  return ON_NPM.reduce((said, [pnpm, npm]) => said.replace(pnpm, npm), line);
}
