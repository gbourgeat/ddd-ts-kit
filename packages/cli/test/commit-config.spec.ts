import { describe, expect, it } from 'vitest';
import { parseConfig, serializeConfig } from '../src/config';
import { cli, read, write } from './helpers';
import { initProject } from './support/init-project';
import { jsonAt } from './support/json-at';

const CONFIG = 'ddd-ts-kit.config.json';

describe('the commit key of the config', () => {
  it('defaults to 20 files and 600 lines, the numbers of the editor hook', () => {
    expect(parseConfig({}).commit).toEqual({ maxFiles: 20, maxLines: 600, agentTrailer: false });

    expect(parseConfig({ commit: { maxFiles: 8 } }).commit).toEqual({
      maxFiles: 8,
      maxLines: 600,
      agentTrailer: false,
    });
  });

  it('reads a limit that is not a positive integer as its default', () => {
    expect(parseConfig({ commit: { maxFiles: 0, maxLines: '300' } }).commit).toEqual({
      maxFiles: 20,
      maxLines: 600,
      agentTrailer: false,
    });

    expect(parseConfig({ commit: { maxFiles: 2.5, maxLines: -1 } }).commit).toEqual({
      maxFiles: 20,
      maxLines: 600,
      agentTrailer: false,
    });

    expect(parseConfig({ commit: 'small' }).commit).toEqual({ maxFiles: 20, maxLines: 600, agentTrailer: false });
  });

  it('is written back only when it differs from the defaults, and read back the same', () => {
    const sized = parseConfig({ commit: { maxFiles: 12, maxLines: 400 } });

    expect(JSON.parse(serializeConfig(sized))).toMatchObject({ commit: { maxFiles: 12, maxLines: 400 } });
    expect(parseConfig(JSON.parse(serializeConfig(sized))).commit).toEqual(sized.commit);
    expect(JSON.parse(serializeConfig(parseConfig({})))).not.toHaveProperty('commit');
  });

  it('passes config/valid with positive integers, or absent', () => {
    expect(configFindings(initProject())).toEqual([]);
    expect(configFindings(withCommit({ maxFiles: 12, maxLines: 400 }))).toEqual([]);
  });

  it('is reported by config/valid, on its line, when a limit is not a positive integer', () => {
    const root = withCommit({ maxFiles: 0, maxLines: '300', maxBytes: 9 });
    const result = cli(root, 'check', '--rule', 'config/valid', '--json');

    expect(result.code).toBe(1);

    expect(configFindings(root)).toEqual([
      '"commit.maxFiles" is 0: it is read as 20.',
      '"commit.maxLines" is "300": it is read as 600.',
      '"commit.maxBytes" is not a limit: it is ignored.',
    ]);

    expect(jsonAt(result.json(), 'violations', '0', 'line')).toBe(
      read(root, CONFIG)
        .split('\n')
        .findIndex((line) => line.includes('"maxFiles"')) + 1,
    );

    expect(configFindings(withCommit([20, 600]))).toEqual(['"commit" is not an object: the default limits are used.']);
  });
});

function withCommit(commit: unknown): string {
  const root = initProject();

  write(root, CONFIG, `${JSON.stringify({ ...(JSON.parse(read(root, CONFIG)) as object), commit }, null, 2)}\n`);

  return root;
}

function configFindings(root: string): string[] {
  const violations = jsonAt(cli(root, 'check', '--rule', 'config/valid', '--json').json(), 'violations');

  return Array.isArray(violations) ? violations.map((violation) => String(jsonAt(violation, 'message'))) : [];
}

describe('the commit.agentTrailer key of the config', () => {
  it('is false unless written true, and written back only when true', () => {
    expect(parseConfig({ commit: { maxFiles: 8 } }).commit.agentTrailer).toBe(false);
    expect(parseConfig({ commit: { agentTrailer: 'yes' } }).commit.agentTrailer).toBe(false);

    expect(parseConfig({ commit: { agentTrailer: true } }).commit).toEqual({
      maxFiles: 20,
      maxLines: 600,
      agentTrailer: true,
    });

    const named = parseConfig({ commit: { agentTrailer: true } });

    expect(JSON.parse(serializeConfig(named))).toMatchObject({ commit: { agentTrailer: true } });
    expect(JSON.parse(serializeConfig(named))).not.toMatchObject({ commit: { maxFiles: 20 } });
    expect(parseConfig(JSON.parse(serializeConfig(named))).commit).toEqual(named.commit);

    expect(JSON.parse(serializeConfig(parseConfig({ commit: { maxFiles: 12 } })))).toEqual(
      expect.objectContaining({ commit: { maxFiles: 12, maxLines: 600 } }),
    );
  });

  it('passes config/valid as a boolean, and is reported otherwise', () => {
    expect(configFindings(withCommit({ agentTrailer: true }))).toEqual([]);

    expect(configFindings(withCommit({ agentTrailer: 'yes' }))).toEqual([
      '"commit.agentTrailer" is "yes": it is read as false.',
    ]);
  });
});
