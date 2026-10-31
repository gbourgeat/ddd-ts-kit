import { describe, expect, it } from 'vitest';
import { cli, write } from './helpers';
import { initProject } from './support/init-project';

const HEADER =
  '| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |\n|---|---|---|---|---|---|---|---|\n';

describe('plan-waves, the rows of the platform and of every context', () => {
  it('orders a row whose context is platform or all, owned by the conductor, and briefs no worker for it', () => {
    const root = initProject();

    write(
      root,
      'docs/architecture/slices.md',
      `# Slices

${HEADER}| M1.01 | platform | skeleton | Authorizer | by hand in \`src/platform/auth/\` | | conductor | todo |
| M1.02 | all | slice | One trace | end-to-end spec | M1.01 | conductor | todo |
`,
    );

    const planned = cli(root, 'plan-waves', '--json');

    expect(planned.code).toBe(0);
    expect(planned.json()).toMatchObject({ problems: [] });
    expect(planned.stdout).not.toContain('worker-scope platform');
    expect(planned.stdout).not.toContain('worker-scope all');
  });
});
