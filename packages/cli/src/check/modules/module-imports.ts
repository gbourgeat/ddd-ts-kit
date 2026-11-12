import type { SourceFile } from '../model/source-file';

/** One import from a production file of one module to a file of another module of the same context: where it is written. */
export interface ModuleImport {
  readonly context: string;
  readonly from: string;
  readonly to: string;
  readonly file: string;
  readonly line: number;
  /** The file the import names, from the project root. */
  readonly imported: string;
}

/**
 * What `module/no-cycle` judges, and a command that moves files before it writes: the imports of
 * the production files of the modules of the model to another module of their context.
 */
export function moduleImports(files: readonly SourceFile[]): ModuleImport[] {
  return files.filter((file) => !file.isTest).flatMap(importsOf);
}

function importsOf({ location, imports, path }: SourceFile): ModuleImport[] {
  if (location.area !== 'context' || location.module === undefined) {
    return [];
  }

  const { context, module: from } = location;

  return imports.flatMap(({ target, line }) => {
    if (target.kind !== 'file' || target.location.area !== 'context') {
      return [];
    }

    const { context: reached, module: to } = target.location;

    return reached === context && to !== undefined && to !== from
      ? [{ context, from, to, file: path, line, imported: target.path }]
      : [];
  });
}
