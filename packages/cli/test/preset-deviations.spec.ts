import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, read } from './helpers';
import { initProject } from './support/init-project';

const CONFIG = 'ddd-ts-kit.config.json';

describe('a preset written into a project that holds deviations', () => {
  it('keeps them and does not record twice the one already there', () => {
    const root = initProject('--tenancy', 'shared-table', '--orm', 'knex');
    const stepdown = { what: 'rules.clean/stepdown', adr: '0007', reason: 'The handlers read better long.' };
    const recorded = { what: 'contexts.people.tenancy', adr: '0008', reason: 'Written by hand before the preset.' };
    const config = JSON.parse(read(root, CONFIG)) as object;

    fs.writeFileSync(path.join(root, CONFIG), JSON.stringify({ ...config, deviations: [stepdown, recorded] }, null, 2));

    expect(cli(root, 'generate', 'context', 'people', '--preset', 'identity').code).toBe(0);
    expect(JSON.parse(read(root, CONFIG))).toMatchObject({ deviations: [stepdown, recorded] });
  });
});
