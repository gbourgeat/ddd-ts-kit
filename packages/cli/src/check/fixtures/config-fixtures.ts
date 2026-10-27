import { CONFIG_FILE } from '../../config';
import { aggregate } from './aggregate';
import { config } from './config';
import { contextDoc } from './context-doc';
import type { Fixture } from './fixture';
import { PATHS } from './paths';
import { project } from './project';
import { SAMPLES } from './samples';
import { source } from './source';

const { AGGREGATE, DECIMAL_ADR } = PATHS;
const LONG_FILE = 'src/platform/ledger-import.ts';
const { RECORD } = SAMPLES;

export const CONFIG_FIXTURES: readonly Fixture[] = [
  {
    ruleId: 'config/valid',
    name: 'a consistent config, a function limit at the ceiling and a complete allowance',
    expect: 'pass',
    files: project(
      {},
      {
        [CONFIG_FILE]: config({
          rules: {
            'naming/suffix': 'warn',
            'test/spec-required': { severity: 'off', files: ['src/contexts/catalog/**'] },
            'domain/no-generic-error': 'warn',
          },
          guard: 'advise',
          limits: { maxFunctionLines: 100 },
          onePerFile: {
            allow: [{ file: 'src/platform/http-*.ts', reason: 'The server and the error it raises are one boundary.' }],
          },
        }),
      },
    ),
  },
  {
    ruleId: 'config/valid',
    name: 'a context whose tenancy is not control-plane',
    expect: { file: CONFIG_FILE },
    files: project(
      {},
      {
        [CONFIG_FILE]: config({
          contexts: {
            billing: { classification: 'core', upstreams: ['catalog'] },
            catalog: { classification: 'supporting', upstreams: [], tenancy: 'outside' },
          },
        }),
      },
    ),
  },
  {
    ruleId: 'config/valid',
    name: 'a function limit above the ceiling of 100 lines',
    expect: { file: CONFIG_FILE },
    files: project({}, { [CONFIG_FILE]: config({ limits: { maxFunctionLines: 250 } }) }),
  },
  {
    ruleId: 'config/valid',
    name: 'an allowance of onePerFile without a reason',
    expect: { file: CONFIG_FILE },
    files: project({}, { [CONFIG_FILE]: config({ onePerFile: { allow: [{ file: 'src/platform/http-server.ts' }] } }) }),
  },
  {
    ruleId: 'config/valid',
    name: 'an unknown upstream',
    expect: { file: CONFIG_FILE },
    files: project(
      {},
      {
        [CONFIG_FILE]: config({
          contexts: {
            billing: { classification: 'core', upstreams: [{ context: 'pricing' }] },
            catalog: { classification: 'supporting', upstreams: [] },
          },
        }),
      },
    ),
  },
  {
    ruleId: 'config/valid',
    name: 'an unknown guard mode',
    expect: { file: CONFIG_FILE },
    files: project({}, { [CONFIG_FILE]: config({ guard: 'strict' }) }),
  },
  {
    ruleId: 'config/valid',
    name: 'an unknown import extension',
    expect: { file: CONFIG_FILE },
    files: project({}, { [CONFIG_FILE]: config({ importExtension: 'ts' }) }),
  },
  {
    ruleId: 'config/valid',
    name: 'an unknown rule id',
    expect: { file: CONFIG_FILE },
    files: project({}, { [CONFIG_FILE]: config({ rules: { 'naming/sufix': 'warn' } }) }),
  },
  {
    ruleId: 'config/valid',
    name: 'a context on disk that the config does not declare',
    expect: { file: 'src/contexts/shipping' },
    files: project({ 'src/contexts/shipping/CONTEXT.md': contextDoc('generic') }),
  },
  {
    ruleId: 'config/valid',
    name: 'a declared context that does not exist on disk',
    expect: { file: CONFIG_FILE },
    files: project(
      {},
      {
        [CONFIG_FILE]: config({
          contexts: {
            billing: { classification: 'core', upstreams: ['catalog'] },
            catalog: { classification: 'supporting', upstreams: [] },
            shipping: { classification: 'generic', upstreams: [] },
          },
        }),
      },
    ),
  },
  {
    ruleId: 'config/suppression-needs-reason',
    name: 'a suppression with a reason silences the violation',
    expect: 'pass',
    files: project({
      ...aggregate(
        "// ddd-ts-kit-disable-next-line layer/domain-purity -- decimal arithmetic approved in ADR 12\nimport Decimal from 'decimal.js';\nexport class Invoice { total = new Decimal(0); }\n",
      ),
      [DECIMAL_ADR]: RECORD,
    }),
  },
  {
    ruleId: 'config/suppression-needs-reason',
    name: 'a suppression without a reason',
    expect: { file: AGGREGATE },
    also: ['layer/domain-purity'],
    files: project(
      aggregate(
        "// ddd-ts-kit-disable-next-line layer/domain-purity\nimport Decimal from 'decimal.js';\nexport class Invoice { total = new Decimal(0); }\n",
      ),
    ),
  },
  {
    ruleId: 'config/valid',
    name: 'a rule set for some files that names none',
    expect: { file: CONFIG_FILE },
    files: project({}, { [CONFIG_FILE]: config({ rules: { 'clean/file-size': { severity: 'off', files: [] } } }) }),
  },
  {
    ruleId: 'config/rule-off-everywhere',
    name: 'a rule off for the files it is meant for, and one off on purpose everywhere',
    expect: 'pass',
    files: project(
      {},
      {
        [CONFIG_FILE]: config({
          rules: {
            'clean/function-size': { severity: 'off', files: ['src/platform/legacy/**'] },
            'test/builder-required': { severity: 'off', files: ['**'] },
          },
        }),
      },
    ),
  },
  {
    ruleId: 'config/rule-off-everywhere',
    name: 'a rule off for the whole project',
    expect: { file: CONFIG_FILE },
    files: project({}, { [CONFIG_FILE]: config({ rules: { 'clean/function-size': 'off' } }) }),
  },
  {
    ruleId: 'clean/file-size',
    name: 'a long file among the files the rule is off for',
    expect: 'pass',
    files: project(
      { [LONG_FILE]: longFile() },
      { [CONFIG_FILE]: config({ rules: { 'clean/file-size': { severity: 'off', files: ['src/platform/*.ts'] } } }) },
    ),
  },
  {
    ruleId: 'clean/file-size',
    name: 'a long file outside the files the rule is off for',
    expect: { file: LONG_FILE },
    files: project(
      { [LONG_FILE]: longFile() },
      {
        [CONFIG_FILE]: config({ rules: { 'clean/file-size': { severity: 'off', files: ['src/platform/legacy/**'] } } }),
      },
    ),
  },
];

/** A source of 351 lines, one past the limit of clean/file-size. */
function longFile(): string {
  return source('export const lines = [', ...Array.from({ length: 349 }, (_, index) => `  ${index},`), '];');
}
