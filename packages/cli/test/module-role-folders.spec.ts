import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROLE_FOLDERS } from '../src/model-modules/index.js';

const DISCOVERY = path.resolve(import.meta.dirname, '../../di/src/discovery/without-module.ts');

describe('the role folders of application/, which tell a module of the model from a role', () => {
  it('are the same for the discovery of @ddd-ts-kit/di, which copies them since it runs without the CLI', () => {
    const source = fs.readFileSync(DISCOVERY, 'utf8');
    const listed = /new Set\(\[([^\]]*)\]\)/.exec(source)?.[1] ?? '';
    const copied = [...listed.matchAll(/'([a-z-]+)'/g)].map(([, folder]) => folder);

    expect([...copied].sort()).toEqual([...(ROLE_FOLDERS['application'] ?? [])].sort());
  });
});
