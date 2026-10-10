import type { ProjectOptions } from './project-options.js';

/*
 * One file, no resolution and no type check: imports are kept as they are written, for the
 * runner to resolve. A target of `ESNext` would leave the decorators in place, which is what
 * this plugin exists to avoid, so the newest dated target stands in for it.
 */
export function singleFileProject(source: string, project: ProjectOptions): unknown {
  const target = typeof project.target === 'string' ? project.target.toLowerCase() : 'es2022';

  return {
    compilerOptions: {
      ...project,
      target: target === 'esnext' ? 'es2024' : target,
      module: 'preserve',
      moduleResolution: 'bundler',
      noResolve: true,
      noCheck: true,
      isolatedModules: true,
      types: [],
      sourceMap: true,
      declaration: false,
      outDir: '.',
      rootDir: '.',
    },
    files: [source],
  };
}
