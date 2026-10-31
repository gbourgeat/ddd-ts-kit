import { CliError } from '../../cli-error';
import type { Name } from '../../naming';
import { renderTemplate } from '../../templating';
import { emit } from '../emit';
import type { Kind } from '../kind';
import { label } from '../label';
import { named } from '../named';
import { openScope } from '../open-scope';
import type { Scope } from '../scope';
import { vars } from '../vars';
import { wire } from '../wire';
import { wiringFamily } from '../wiring-family';
import { publishInIndex } from './publish-in-index';
import { platformPath } from '../platform-path';
import { ownEntry } from '../../config/values/own-entry';

export const gatewayKind: Kind = {
  name: 'gateway',
  aliases: [],
  usage: 'gateway <context> <upstreamContext> <Name>',
  summary:
    "A port of the caller for a synchronous need from an upstream, its in-process adapter over the upstream's published read contract, a fake and one contract suite.",
  positionals: ['context', 'upstreamContext', 'Name'],
  writesShared: true,
  writesInModules: true,
  run: (request) => {
    const scope = openScope(request);
    const upstream = declaredUpstream(scope, request.args[1] ?? '');
    const name = label(scope, request.args[2] ?? '', { what: 'gateway', strip: ['gateway'] });
    const context = vars(scope, { name: named(name), upstream: { kebab: upstream } });
    const published = `${scope.config.contextsDir}/${upstream}/published-language`;

    scope.ws.create(`${published}/${name.kebab}.contract.ts`, renderTemplate('gateway/contract.ts.tpl', context));
    publishInIndex(scope, published, `${name.kebab}.contract`);

    emit(scope, context, [
      ['gateway/port.ts.tpl', `application/ports/${name.kebab}-gateway.port.ts`],
      ['gateway/adapter.ts.tpl', `infrastructure/external/in-process-${name.kebab}.gateway.ts`],
      ['gateway/fake.ts.tpl', `test/fakes/${name.kebab}-gateway.fake.ts`],
      ['gateway/contract.spec.ts.tpl', `test/integration/${name.kebab}-gateway.contract.spec.ts`],
    ]);

    wire(scope, 'gateway', context);
    explain(scope, upstream, name);
  },
};

function declaredUpstream(scope: Scope, upstream: string): string {
  if (
    ownEntry(scope.config.contexts, scope.context.kebab)?.upstreams.some(
      (candidate) => candidate.context === upstream,
    ) === true
  ) {
    scope.flags.builtOn?.(`${scope.config.contextsDir}/${upstream}/CONTEXT.md`);

    return upstream;
  }

  refuseCycle(scope, upstream);

  throw new CliError(
    `"${scope.context.kebab}" does not declare "${upstream}" as an upstream.`,
    `Declare the relationship first: add { "context": "${upstream}", "relationship": "customer-supplier" } to contexts.${scope.context.kebab}.upstreams, then run the command again.`,
  );
}

/** Declaring the upstream the other context already depends on would close a cycle, which `context/no-cycle` reports. */
function refuseCycle(scope: Scope, upstream: string): void {
  const here = scope.context.kebab;

  if (ownEntry(scope.config.contexts, upstream)?.upstreams.some((candidate) => candidate.context === here) !== true) {
    return;
  }

  throw new CliError(
    `"${upstream}" already has "${here}" as an upstream: a gateway of "${here}" to "${upstream}" closes the cycle ${here} -> ${upstream} -> ${here} (context/no-cycle).`,
    `Keep the dependency in one direction: generate the gateway in "${upstream}" against "${here}", or let "${here}" react to an integration event of "${upstream}" (\`ddd-ts-kit generate integration-handler\`).`,
  );
}

/** Where the contract is bound today, and what extracting the upstream will change. */
function explain(scope: Scope, upstream: string, name: Name): void {
  const { ws, config, context } = scope;

  const where: Readonly<Record<string, string>> = {
    declared: `${name.pascal}Contract is bound to an empty value in ${platformPath(scope, 'composition/platform.module.ts')} and in ${platformPath(scope, 'composition/platform-test.module.ts')}: bind the implementation ${upstream} gives of it there.`,
    container: `${name.pascal}Contract is bound to an empty value in ${context.kebab}.module.ts: bind the implementation ${upstream} gives of it there.`,
    manual: `Instantiate InProcess${name.pascal}Gateway in ${context.kebab}.module.ts, with the implementation of ${name.pascal}Contract the platform hands over, and give it to the handlers that need it.`,
  };

  ws.note(where[wiringFamily(config)] ?? '');

  ws.note(
    `${name.pascal}Contract is published by ${upstream}: implement it there and hand that implementation to the gateway in the composition root. Extracting ${upstream} then replaces the in-process adapter by a remote one, and nothing else.`,
  );
}
