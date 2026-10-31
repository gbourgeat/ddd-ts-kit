import { describe, expect, it } from 'vitest';
import { cli, exists } from './helpers';
import { initProject } from './support/init-project';

const RESERVED = ['Con', 'prn', 'AUX', 'Nul', 'COM1', 'com9', 'Lpt1', 'lpt9'];

describe('the names Windows reserves for a device', () => {
  const project = (): string => initProject('--context', 'notes:core', '--audit', 'off');

  it.each(RESERVED)('are refused for a concept as %s, nothing written', (name) => {
    const root = project();
    const refused = cli(root, 'generate', 'port', 'notes', name);

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('is a name Windows reserves for a device');
    expect(refused.stderr).toContain('--allow-name');
    expect(exists(root, `src/contexts/notes/domain/ports/${name.toLowerCase()}.port.ts`)).toBe(false);
  });

  it.each(RESERVED)('are refused for a context as %s', (name) => {
    const refused = cli(project(), 'generate', 'context', name, '--classification', 'generic');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('is a name Windows reserves for a device');
  });

  it('are refused for an error too, and --allow-name lets one through', () => {
    const root = project();

    expect(cli(root, 'generate', 'error', 'notes', 'Com1', 'forX', '--term', 'Com1=x').code).toBe(2);
    expect(cli(root, 'generate', 'aggregate', 'notes', 'Con', '--term', 'Con=x').code).toBe(2);
    expect(cli(root, 'generate', 'aggregate', 'notes', 'Con', '--term', 'Con=x', '--allow-name').code).toBe(0);
    expect(exists(root, 'src/contexts/notes/domain/aggregates/con.aggregate.ts')).toBe(true);
  });

  it('leave the names that only start with one alone', () => {
    const root = project();

    expect(cli(root, 'generate', 'port', 'notes', 'Console').code).toBe(0);
    expect(cli(root, 'generate', 'port', 'notes', 'Com10').code).toBe(0);
  });
});
