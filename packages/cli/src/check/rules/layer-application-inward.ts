import { outsideConcern } from '../layers/outside-concern';
import type { Flaw } from '../model/flaw';
import type { Layer } from '../model/layer';
import type { Location } from '../model/location';
import type { ResolvedImport } from '../model/resolved-import';
import type { Rule } from '../model/rule';
import { bindingPlace } from '../support/binding-place';
import { describeTarget } from '../support/describe-target';
import { inLayer } from '../support/in-layer';
import { isDeclaredStyle } from '../support/is-declared-style';
import { perFile } from '../support/per-file';
import { VALIDATION_PACKAGES } from '../schemas/validation-packages';
import { isBackgroundJobFile } from '../scheduling/is-background-job-file';

const INWARD: readonly Layer[] = ['domain', 'application', 'published-language'];
const BUILTIN_FIX = 'Hide the I/O behind a port in application/ports and implement it in infrastructure/external.';

/** What the judgment of one import needs to know about the file that holds it. */
interface Wiring {
  readonly context: string;
  readonly allowed: readonly string[];
  /** Where an adapter is bound to its port, for the fix. */
  readonly binding: string;
  readonly declared: boolean;
}

export const layerApplicationInward: Rule = {
  id: 'layer/application-inward',
  description:
    'application/ imports domain/, application/, published languages and the allowed kernel packages: never infrastructure/, presentation/, a framework or a driver. A background job (application/background/*.background-job.ts) also imports the validation library its payload schema is written with.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => {
      const here = inLayer(file, 'application');

      if (here === undefined) {
        return [];
      }

      const wiring: Wiring = {
        context: here.context,
        allowed: allowedPackages(file.path, here, project.config.applicationAllowedPackages),
        binding: bindingPlace(project, here.context),
        declared: isDeclaredStyle(project),
      };

      return file.imports.flatMap((imported) =>
        outward(imported, wiring).map((flaw) => ({ line: imported.line, ...flaw })),
      );
    });
  },
};

/**
 * A stored payload outlives the deploy that enqueued it, like the payload of an integration
 * event: a background job declares its schema with the validation library of the project.
 */
function allowedPackages(path: string, here: Location, configured: readonly string[]): readonly string[] {
  return isBackgroundJobFile(path, here) ? [...configured, ...VALIDATION_PACKAGES] : configured;
}

function outward({ target, specifier }: ResolvedImport, wiring: Wiring): Flaw[] {
  if (target.kind === 'builtin') {
    return [{ message: `The application layer imports the Node built-in "${specifier}".`, fix: BUILTIN_FIX }];
  }

  if (target.kind === 'package') {
    return outsidePackage(target.name, specifier, wiring);
  }

  if (isInward(target.location, wiring.context)) {
    return [];
  }

  const binder = wiring.declared ? 'the declaration of the adapter' : 'the module file';
  const fix = `Depend on a port instead, an abstract class of application/ports or of domain/repositories, and let ${binder} bind the adapter.`;

  return [{ message: `The application layer imports ${describeTarget(target)}.`, fix }];
}

function outsidePackage(name: string, specifier: string, { allowed, binding }: Wiring): Flaw[] {
  const concern = outsideConcern('The application layer', name, specifier);

  if (concern !== undefined) {
    return [concern];
  }

  if (allowed.includes(name)) {
    return [];
  }

  const fix = `Declare a port in application/ports, an abstract class named after the need, implement it with "${name}" in infrastructure/, and bind it in ${binding}.`;

  return [{ message: `The application layer imports the package "${name}".`, fix }];
}

function isInward(there: Location, context: string): boolean {
  if (there.area === 'shared-kernel') {
    return true;
  }

  // Another context: the context/* rules decide.
  if (there.area === 'context' && there.context !== context) {
    return true;
  }

  return there.area === 'context' && INWARD.includes(there.layer);
}
