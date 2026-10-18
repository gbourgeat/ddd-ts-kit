import { describe, expect, it } from 'vitest';
import { parseConfig, restackConfigText } from '../src/config/index.js';

const DEVIATION = { what: 'a hand-written mapper', adr: 'docs/adr/0003.md', reason: 'legacy schema' };

function restacked(content: string, raw: Record<string, unknown>, worker = false): Record<string, unknown> {
  return JSON.parse(restackConfigText(content, { ...parseConfig(raw), worker })) as Record<string, unknown>;
}

describe('the config text of a project after init --force', () => {
  it('keeps the version the file records first when the run gives none, and the spelling after the other keys', () => {
    const text = '{\n  "contexts": [],\n  "initVersion": "0.70.0"\n}\n';
    const written = restacked(text, {});

    expect(Object.keys(written).slice(0, 4)).toEqual(['initVersion', 'contexts', 'importAlias', 'importExtension']);
    expect(written['initVersion']).toBe('0.70.0');
  });

  it('adds the deviations the run recorded over a value that is not a list, and the client --sdk asked for', () => {
    const written = restacked('{\n  "deviations": "none"\n}\n', {
      deviations: [DEVIATION],
      sdk: { name: 'shop-client' },
    });

    expect(written['deviations']).toEqual([DEVIATION]);
    expect(written['sdk']).toEqual({ name: 'shop-client' });
  });

  it('keeps the client and the pipeline settings the team wrote, the extra jobs of the run merged in', () => {
    const text = '{\n  "sdk": { "name": "kept" },\n  "ci": { "node": 22, "extras": [] }\n}\n';
    const written = restacked(text, { sdk: { name: 'shop-client' }, ci: { extras: ['mutation'] } }, true);

    expect(written['sdk']).toEqual({ name: 'kept' });
    expect(written['ci']).toEqual({ node: 22, extras: ['mutation'] });
    expect(written['worker']).toBe(true);
  });

  it('writes the extra jobs of the run over a pipeline value that is not an object, and drops it when there are none', () => {
    expect(restacked('{\n  "ci": "github"\n}\n', { ci: { extras: ['mutation'] } })['ci']).toEqual({
      extras: ['mutation'],
    });

    expect(restacked('{\n  "ci": { "extras": ["mutation"] }\n}\n', {})).not.toHaveProperty('ci');
  });
});
