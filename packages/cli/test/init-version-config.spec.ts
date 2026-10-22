import { describe, expect, it } from 'vitest';
import { parseConfig, serializeConfig } from '../src/config';
import { cli, read, write } from './helpers';
import { initProject } from './support/init-project';
import { jsonAt } from './support/json-at';

const CONFIG = 'ddd-ts-kit.config.json';

describe('the initVersion key of the config', () => {
  it('is read as written, and absent from a project initialised before the key existed', () => {
    expect(parseConfig({ initVersion: '0.1.0' }).initVersion).toBe('0.1.0');
    expect(parseConfig({}).initVersion).toBeUndefined();
    expect(parseConfig({ initVersion: 26 }).initVersion).toBeUndefined();
  });

  it('is written back first when known, and not at all otherwise', () => {
    const recorded = parseConfig({ initVersion: '0.1.0' });

    expect(Object.keys(JSON.parse(serializeConfig(recorded)))[0]).toBe('initVersion');
    expect(parseConfig(JSON.parse(serializeConfig(recorded))).initVersion).toBe('0.1.0');
    expect(JSON.parse(serializeConfig(parseConfig({})))).not.toHaveProperty('initVersion');
  });

  it('passes config/valid, written or absent, and every command reads a config without it', () => {
    const root = initProject();

    expect(configFindings(root)).toEqual([]);

    const { initVersion: _written, ...older } = JSON.parse(read(root, CONFIG)) as Record<string, unknown>;

    write(root, CONFIG, `${JSON.stringify(older, null, 2)}\n`);

    expect(configFindings(root)).toEqual([]);
    expect(cli(root, 'generate', 'context', 'billing', '--classification', 'core').code).toBe(0);
    expect(JSON.parse(read(root, CONFIG))).not.toHaveProperty('initVersion');
  });
});

function configFindings(root: string): string[] {
  const violations = jsonAt(cli(root, 'check', '--rule', 'config/valid', '--json').json(), 'violations');

  return Array.isArray(violations) ? violations.map((violation) => String(jsonAt(violation, 'message'))) : [];
}
