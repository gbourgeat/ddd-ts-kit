import type { Project } from '../model/project';
import { importedFrom } from '../support/imported-from';
import { inLayer } from '../support/in-layer';

/** A port of a context: the name of its class and the file that declares it. */
interface Port {
  readonly context: string;
  readonly name: string;
  readonly path: string;
}

/**
 * The folders of `infrastructure/` of the context where a production class implements the port,
 * one entry per class: `persistence`, `external`.., or an empty string right under `infrastructure/`.
 */
export function adapterFolders(project: Project, { context, name, path }: Port): string[] {
  return project.files.flatMap((file) => {
    const place = inLayer(file, 'infrastructure');
    const target = place?.context === context ? importedFrom(file, name)?.target : undefined;

    if (place === undefined || target?.kind !== 'file' || target.path !== path) {
      return [];
    }

    const adapters = file.structure.classes.filter((shape) => shape.implemented.includes(name));

    return adapters.map(() => (place.inside.length > 1 ? (place.inside[0] ?? '') : ''));
  });
}
