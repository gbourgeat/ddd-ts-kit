import { describe, expect, it } from 'vitest';
import { read } from './helpers';
import { initProject } from './support/init-project';

const exportOf = (root: string): string => read(root, 'src/platform/privacy/run-export.ts');

describe('the export of a person in a generated project with an event store', () => {
  it('hands over what the event store keeps of the person beside the exports of the contexts, once it has one', () => {
    const rows = initProject();
    const events = initProject('--event-sourcing', 'on');
    const byHand = initProject('--di', 'manual', '--orm', 'knex', '--event-sourcing', 'on', '--audit', 'off');

    expect(exportOf(rows)).not.toContain('EventStorePersonalDataExport');

    expect(exportOf(events)).toContain(
      'const exports = [...dataSubjectExports.map((port) => container.resolve(port)), eventStoreExport(container)].map(',
    );

    expect(exportOf(events)).toContain('events: container.resolve(EventStore),');
    expect(exportOf(events)).toContain("name: 'platform.event-store',");
    expect(read(events, 'scripts/privacy-export.ts')).toContain('every value the event store keeps sealed');
    expect(exportOf(byHand)).toContain('eventStoreExport(platform),');
    expect(exportOf(byHand)).toContain('const { events, subjectKeys } = platform.eventSourcing;');
  });
});
