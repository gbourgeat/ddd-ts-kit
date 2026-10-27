import { describe, expect, it } from 'vitest';
import { cli, read } from './helpers';
import { type Report, report } from './reports';
import { initProject } from './support/init-project';
import { PURPOSE } from './support/project-with-module';

describe('generate domain-event on an event the aggregate already has', () => {
  const INCIDENTS = 'src/contexts/incidents';
  const TERMS = ['--term', 'Incident=Something gone wrong', '--term', 'Trigger=To raise', '--term', 'Close=To end'];

  function files(dir: string): readonly string[] {
    return [
      `${dir}/domain/aggregates/incident.aggregate.ts`,
      `${dir}/infrastructure/persistence/incident-events.mapper.ts`,
    ];
  }

  function generate(project: string, ...args: string[]): Report {
    return report(cli(project, 'generate', ...args, ...TERMS, '--json'));
  }

  function contents(project: string, written: readonly string[]): readonly string[] {
    return written.map((file) => read(project, file));
  }

  it('leaves the aggregate and the codec unchanged when the event is the birth event of aggregate --birth', () => {
    const project = initProject('--context', 'incidents:core', '--event-sourcing', 'on');

    generate(project, 'aggregate', 'incidents', 'Incident', '--event-sourced', '--birth', 'Triggered');

    const born = contents(project, files(INCIDENTS));
    const again = generate(project, 'domain-event', 'incidents', 'Incident', 'Triggered');

    expect(again.skipped).toContain(`${INCIDENTS}/domain/events/incident-triggered.event.ts`);
    expect(again.updated).toEqual([]);
    expect(contents(project, files(INCIDENTS))).toEqual(born);
  });

  it('adds a later event once, and a second run of the same command changes nothing', () => {
    const project = initProject('--context', 'incidents:core', '--event-sourcing', 'on');

    generate(project, 'aggregate', 'incidents', 'Incident', '--event-sourced', '--birth', 'Triggered');
    generate(project, 'domain-event', 'incidents', 'Incident', 'Closed');

    const extended = contents(project, files(INCIDENTS));

    expect(extended[0]?.match(/private applyClosed\(/g)).toHaveLength(1);
    expect(extended[1]?.match(/type IncidentClosedData =/g)).toHaveLength(1);
    expect(generate(project, 'domain-event', 'incidents', 'Incident', 'Closed').updated).toEqual([]);
    expect(contents(project, files(INCIDENTS))).toEqual(extended);
  });

  it('leaves the aggregate of a module unchanged when the event is its birth event', () => {
    const project = initProject('--context', 'incidents:core', '--event-sourcing', 'on');

    const module = cli(
      project,
      'generate',
      'module',
      'incidents',
      'response',
      '--purpose',
      PURPOSE,
      '--term',
      'Response=Handling an incident',
    );

    expect(module.code, module.stderr).toBe(0);

    const inModule = ['--module', 'response'];
    const written = files(`${INCIDENTS}/response`);

    generate(project, 'aggregate', 'incidents', 'Incident', '--event-sourced', '--birth', 'Triggered', ...inModule);

    const born = contents(project, written);

    expect(generate(project, 'domain-event', 'incidents', 'Incident', 'Triggered', ...inModule).updated).toEqual([]);
    expect(contents(project, written)).toEqual(born);
  });

  it('leaves an aggregate that is not event-sourced unchanged, however many times its event is generated', () => {
    const project = initProject('--context', 'incidents:core');
    const aggregate = `${INCIDENTS}/domain/aggregates/incident.aggregate.ts`;

    generate(project, 'aggregate', 'incidents', 'Incident');

    const before = read(project, aggregate);

    generate(project, 'domain-event', 'incidents', 'Incident', 'Triggered');

    expect(generate(project, 'domain-event', 'incidents', 'Incident', 'Triggered').updated).toEqual([]);
    expect(read(project, aggregate)).toBe(before);
  });
});
