import { outsideConcern } from '../layers/outside-concern.js';
import type { Flaw } from '../model/flaw.js';
import type { Layer } from '../model/layer.js';
import type { Location } from '../model/location.js';
import type { ResolvedImport } from '../model/resolved-import.js';
import type { Rule } from '../model/rule.js';
import { bindingPlace } from '../support/binding-place.js';
import { describeTarget } from '../support/describe-target.js';
import { inLayer } from '../support/in-layer.js';
import { isDeclaredStyle } from '../support/is-declared-style.js';
import { perFile } from '../support/per-file.js';

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
    'application/ imports domain/, application/, published languages and the allowed kernel packages: never infrastructure/, presentation/, a framework or a driver.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => {
      const here = inLayer(file, 'application');

      if (here === undefined) {
        return [];
      }

      const wiring: Wiring = {
        context: here.context,
        allowed: project.config.applicationAllowedPackages,
        binding: bindingPlace(project, here.context),
        declared: isDeclaredStyle(project),
      };

      return file.imports.flatMap((imported) =>
        outward(imported, wiring).map((flaw) => ({ line: imported.line, ...flaw })),
      );
    });
  },
};

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
