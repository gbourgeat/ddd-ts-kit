import { describe, expect, it } from 'vitest';
import { runCheck } from '../src/check/engine/run-check';
import { loadProject } from '../src/check/project/load-project';
import { projectWith, reported } from './rules-support';

const LEGACY = 'src/platform/legacy/ledger-import.ts';
const CURRENT = 'src/platform/ledger-export.ts';
const LONG = `export const lines = [\n${Array.from({ length: 349 }, (_, index) => `  ${index},\n`).join('')}];\n`;
const RECORDED = [{ what: 'rules.clean/file-size', adr: '0001', reason: 'The legacy import is retired next quarter.' }];

describe('a rule set for some files', () => {
  const projectSetting = (severity: string): string =>
    projectWith(
      { [LEGACY]: LONG, [CURRENT]: LONG, 'docs/adr/0001-legacy-import.md': '# Legacy import\n' },
      { rules: { 'clean/file-size': { severity, files: ['src/platform/legacy/**'] } }, deviations: RECORDED },
    );

  it('gives its severity to the findings on those files, and the default to the others', () => {
    const { violations } = runCheck(loadProject(projectSetting('warn')), { rules: ['clean/file-size'] });

    expect(violations.map(({ file, severity }) => ({ file, severity }))).toEqual([
      { file: CURRENT, severity: 'error' },
      { file: LEGACY, severity: 'warn' },
    ]);
  });

  it('drops the findings on those files when it is off, in the full check and in check-file', () => {
    const root = projectSetting('off');

    expect(reported(root, 'clean/file-size').map(({ file }) => file)).toEqual([CURRENT]);
    expect(reported(root, 'clean/file-size', LEGACY)).toEqual([]);
    expect(reported(root, 'clean/file-size', CURRENT).map(({ file }) => file)).toEqual([CURRENT]);
  });

  it('still needs a deviation, and is not a rule off for the whole project', () => {
    const unrecorded = projectWith(
      {},
      { rules: { 'clean/file-size': { severity: 'off', files: ['src/platform/legacy/**'] } } },
    );

    expect(reported(unrecorded, 'governance/recorded-deviation').map(({ message }) => message)).toEqual([
      'The rule "clean/file-size" is lowered to "off" for some files, and no deviation records why.',
    ]);

    expect(reported(unrecorded, 'config/rule-off-everywhere')).toEqual([]);
  });

  it('reports a rule off for the whole project on its line of the config', () => {
    const root = projectWith({}, { rules: { 'clean/file-size': 'off' }, deviations: RECORDED });

    expect(reported(root, 'config/rule-off-everywhere')).toEqual([
      {
        file: 'ddd-ts-kit.config.json',
        line: 15,
        message:
          'The rule "clean/file-size" is off for the whole project: no file is judged by it, not only the ones its exception is about.',
      },
    ]);
  });
});
