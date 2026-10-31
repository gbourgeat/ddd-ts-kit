import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const guide = (file: string): string =>
  fs.readFileSync(path.join(__dirname, '..', '..', '..', 'docs', 'guides', file), 'utf8');

describe('the guide of the sandbox, on what the allow-list of domains stops', () => {
  it.each([
    ['agent-sandbox.md', 'judges the host and the port, never what is sent', 'no exfiltration by `curl`'],
    ['agent-sandbox.fr.md', "juge l'hôte et le port, jamais ce qui est envoyé", 'aucune exfiltration par `curl`'],
  ])('%s says it stops other hosts, not data sent to an allowed one', (file, said, claimed) => {
    expect(guide(file)).toContain(said);
    expect(guide(file)).not.toContain(claimed);
  });
});
