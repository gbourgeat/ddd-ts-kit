import { CliError } from '../../errors.js';
import { renderTemplate } from '../../templates.js';
import { declarePermission, permissionNamed } from '../access.js';
import { isDeclared } from '../declared.js';
import { applyWiring, emit, wire } from '../emit.js';
import type { Kind } from '../kind.js';
import { label } from '../language.js';
import { named, openScope, vars } from '../scope.js';

export const policyKind: Kind = {
  name: 'policy',
  aliases: [],
  usage: 'policy <context> <Name> --permission <aggregate>.<action>',
  summary: 'A rule about one element (only the author, not after closing), its spec and its registration with the policies Access asks.',
  positionals: ['context', 'Name'],
  run: (request) => {
    const scope = openScope(request);
    const name = label(scope, request.args[1] ?? '', { what: 'policy', strip: ['policy'] });
    const { permission } = scope.flags;
    if (permission === undefined) {
      throw new CliError('A policy needs --permission.', 'A policy refines one permission: pass --permission <aggregate>.<action>, for example --permission invoice.void.');
    }
    declarePermission(scope, permissionNamed(scope, permission), name);
    const context = vars(scope, { name: named(name), access: { permission } });
    emit(scope, context, [
      ['policy/policy.ts.tpl', `application/authorization/${name.kebab}.policy.ts`],
      ['policy/policy.spec.ts.tpl', `test/unit/${name.kebab}.policy.spec.ts`],
    ]);
    // A declared policy is found through its decorator: only a policy written as a value is listed for `Access`.
    if (!isDeclared(scope.config)) applyWiring(scope.ws, `${scope.config.platformDir}/auth/access-policies.ts`, renderTemplate('policy/registration.tpl', context));
  },
};

export const gatewayKind: Kind = {
  name: 'gateway',
  aliases: [],
  usage: 'gateway <context> <upstreamContext> <Name>',
  summary: "A port of the caller for a synchronous need from an upstream, its in-process adapter over the upstream's published read contract, a fake and one contract suite.",
  positionals: ['context', 'upstreamContext', 'Name'],
  run: (request) => {
    const scope = openScope(request);
    const upstream = request.args[1] ?? '';
    if (scope.config.contexts[scope.context.kebab]?.upstreams.some((candidate) => candidate.context === upstream) !== true) {
      throw new CliError(`"${scope.context.kebab}" does not declare "${upstream}" as an upstream.`, `Declare the relationship first: add { "context": "${upstream}", "relationship": "customer-supplier" } to contexts.${scope.context.kebab}.upstreams, then run the command again.`);
    }
    const name = label(scope, request.args[2] ?? '', { what: 'gateway', strip: ['gateway'] });
    const context = vars(scope, { name: named(name), upstream: { kebab: upstream } });
    publishContract({ ws: scope.ws, directory: `${scope.config.contextsDir}/${upstream}/published-language`, file: `${name.kebab}.contract`, content: renderTemplate('gateway/contract.ts.tpl', context) });
    emit(scope, context, [
      ['gateway/port.ts.tpl', `application/ports/${name.kebab}-gateway.port.ts`],
      ['gateway/adapter.ts.tpl', `infrastructure/external/in-process-${name.kebab}.gateway.ts`],
      ['gateway/fake.ts.tpl', `test/fakes/${name.kebab}-gateway.fake.ts`],
      ['gateway/contract.spec.ts.tpl', `test/integration/${name.kebab}-gateway.contract.spec.ts`],
    ]);
    if (scope.config.stack.di === 'tsyringe') wire(scope, 'gateway', context);
    else scope.ws.note(`Instantiate InProcess${name.pascal}Gateway in ${scope.context.kebab}.module.ts, with the implementation of ${name.pascal}Contract the platform hands over, and give it to the handlers that need it.`);
    if (isDeclared(scope.config)) scope.ws.note(`${name.constant}_UPSTREAM is bound to an empty value in ${scope.config.platformDir}/platform.module.ts, for the application and for the specs: bind the implementation of ${name.pascal}Contract there.`);
    scope.ws.note(`${name.pascal}Contract is published by ${upstream}: implement it there and hand that implementation to the gateway in the composition root. Extracting ${upstream} then replaces the in-process adapter by a remote one, and nothing else.`);
  },
};

interface PublishedFile {
  readonly ws: Parameters<typeof applyWiring>[0];
  readonly directory: string;
  readonly file: string;
  readonly content: string;
}

function publishContract({ ws, directory, file, content }: PublishedFile): void {
  ws.create(`${directory}/${file}.ts`, content);
  const index = `${directory}/index.ts`;
  const line = `export * from './${file}.js';`;
  const lines = (ws.read(index) ?? '').split('\n').filter((existing) => existing.trim() !== '' && existing.trim() !== 'export {};');
  if (lines.includes(line)) return;
  const next = `${[...lines, line].join('\n')}\n`;
  if (ws.exists(index)) ws.update(index, next);
  else ws.create(index, next);
}
