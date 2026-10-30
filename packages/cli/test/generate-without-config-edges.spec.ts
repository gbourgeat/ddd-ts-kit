import { describe, expect, it } from 'vitest';
import { parseConfig } from '../src/config';
import { adrKind } from '../src/generate/kinds/adr-kind';
import { moduleKind } from '../src/generate/kinds/module-kind';
import { toName } from '../src/naming';
import { NO_FLAGS } from '../src/presets/no-flags';
import { outsideTheTenancy } from '../src/presets/outside-the-tenancy';
import { Workspace } from '../src/workspace';
import { tempDir, write } from './helpers';

const CONFIG = parseConfig({ contexts: { billing: { classification: 'core' } } });
const CONTEXT_DOC = 'src/contexts/billing/CONTEXT.md';

const GLOSSARY = [
  '# Billing',
  '',
  '## Ubiquitous language',
  '',
  '| Term | Meaning |',
  '|---|---|',
  '| Invoice | A request for payment |',
  '',
].join('\n');

/** A kind or a preset given a workspace whose root holds no config: what it would declare there is left undeclared. */
describe('a generator run over a workspace that holds no config file', () => {
  it('writes the decision record of a deviation and declares the deviation nowhere', () => {
    const ws = new Workspace(tempDir('adr-no-config'), false);

    adrKind.run({
      ws,
      config: CONFIG,
      args: ['Keep one database'],
      flags: { ...NO_FLAGS, deviation: 'rules.clean/stepdown', reason: 'The handlers read better long.' },
    });

    expect(ws.commit(false)).toMatchObject({ created: ['docs/adr/0001-keep-one-database.md'], updated: [] });
  });

  it('writes the row of a module in CONTEXT.md and declares the module nowhere', () => {
    const root = tempDir('module-no-config');
    const ws = new Workspace(root, false);

    write(root, CONTEXT_DOC, GLOSSARY);
    moduleKind.run({ ws, config: CONFIG, args: ['billing', 'invoices'], flags: NO_FLAGS });

    expect(ws.commit(false)).toMatchObject({ created: [], updated: [CONTEXT_DOC] });
  });

  it('leaves the config of a preset as it stands when the file is not there', () => {
    const ws = new Workspace(tempDir('tenancy-no-config'), false);
    const scope = { ws, config: CONFIG, context: toName('identity'), dir: 'src/contexts/identity', flags: NO_FLAGS };

    expect(outsideTheTenancy(scope, 'ADR-0001')).toBe(CONFIG);
    expect(ws.commit(false)).toMatchObject({ created: [], updated: [] });
  });
});
