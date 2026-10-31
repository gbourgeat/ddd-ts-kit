import { describe, expect, it } from 'vitest';
import { read } from './helpers';
import { initProject } from './support/init-project';

describe('init test reporters', () => {
  it('keeps the reporters Vitest picks, a terse one under a coding agent, and adds the budget one', () => {
    const config = read(initProject(), 'vitest.config.ts');

    expect(config).toContain(
      "import { configDefaults, defineConfig, type TestProjectInlineConfiguration } from 'vitest/config';",
    );

    expect(config).toContain("reporters: [...configDefaults.reporters, '@ddd-ts-kit/testing/budget/vitest'],");
  });

  it('asks Jest for its summary reporter under a coding agent', () => {
    const config = read(initProject('--tests', 'jest'), 'jest.config.js');

    expect(config).toContain('const agent = Boolean(process.env.AI_AGENT || process.env.CLAUDECODE);');
    expect(config).toContain("reporters: [agent ? 'summary' : 'default', '@ddd-ts-kit/testing/budget/jest'],");
  });
});
