import { describe, expect, it } from 'vitest';
import { cli, read, tempDir, write } from './helpers';

const STALE = "import { place } from '@/platform/place.js';\n";

/** A project whose output directory holds what an earlier build left, alias included, and whose build config is `build`. */
function withAnEarlierOutput(build: unknown, more: Readonly<Record<string, unknown>> = {}): string {
  const root = tempDir('build-aliases-no-emit');

  write(root, 'ddd-ts-kit.config.json', JSON.stringify({ contexts: {} }));
  write(root, 'package.json', JSON.stringify({ name: 'stale', type: 'module' }));
  write(root, 'tsconfig.json', JSON.stringify({ compilerOptions: { rootDir: '.', outDir: 'dist', noEmit: true } }));
  write(root, 'tsconfig.build.json', JSON.stringify(build));
  Object.entries(more).forEach(([file, content]) => write(root, file, JSON.stringify(content)));
  write(root, 'dist/src/main.js', STALE);
  write(root, 'dist/src/platform/place.js', 'export const place = 1;\n');

  return root;
}

describe('build-aliases after a build that emitted nothing', () => {
  it('refuses a tsconfig that inherits "noEmit", names it and what to write, and leaves the earlier output as it was', () => {
    const root = withAnEarlierOutput({ extends: './tsconfig.json', exclude: ['test'] });
    const refused = cli(root, 'build-aliases');

    expect(refused.code).toBe(2);

    expect(refused.stderr).toContain(
      'tsconfig.build.json resolves "noEmit": true: the compiler wrote nothing with it, and what its output directory holds is not this build.',
    );

    expect(refused.stderr).toContain('Write "noEmit": false under "compilerOptions" in tsconfig.build.json');
    expect(read(root, 'dist/src/main.js')).toBe(STALE);
  });

  it('follows an extends written without ".json", and one that names a package installed in the project', () => {
    const bare = withAnEarlierOutput({ extends: './tsconfig' });

    const packaged = withAnEarlierOutput(
      { extends: ['@acme/tsconfig'], compilerOptions: { rootDir: '.', outDir: 'dist' } },
      { 'node_modules/@acme/tsconfig/tsconfig.json': { compilerOptions: { noEmit: true } } },
    );

    expect(cli(bare, 'build-aliases').stderr).toContain('tsconfig.build.json resolves "noEmit": true');
    expect(cli(packaged, 'build-aliases').stderr).toContain('tsconfig.build.json resolves "noEmit": true');
  });

  it('rewrites the output of a tsconfig that sets "noEmit" back', () => {
    const root = withAnEarlierOutput({ extends: './tsconfig.json', compilerOptions: { noEmit: false } });

    expect(cli(root, 'build-aliases').code).toBe(0);
    expect(read(root, 'dist/src/main.js')).toBe("import { place } from './platform/place.js';\n");
  });
});
