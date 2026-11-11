import { describe, expect, it } from '{{tests.module}}';
import { {{personal.names.fake}} } from '{{alias.context}}/test/fakes/{{personal.names.portKebab}}.fake{{alias.ext}}';
import { {{personal.names.exportFake}} } from '{{alias.context}}/test/fakes/{{personal.names.exportPortKebab}}.fake{{alias.ext}}';

/** The source every record of `{{aggregate.table}}` names: the context, then the table. */
const SOURCE = '{{context.kebab}}.{{aggregate.table}}';

// TODO(domain): no aggregate owns {{aggregate.table}}, so no repository nor builder writes its rows here. Open the test database (openTestDatabase of the platform), insert the rows of two people as the project writes that table, build {{personal.names.adapter}} and {{personal.names.exportAdapter}} on it, and replace each entry below by its test.
describe('{{personal.names.adapter}}, on {{aggregate.table}}', () => {
  it.todo('erases what the table keeps of the subject, as the declaration says, and leaves the others');
  it.todo('reaches nothing the second time: an erasure run again completes one that failed half way');
{{#if personal.retains}}
  it.todo('erases the rows whose retention ended, as the declaration says, and leaves the others');
{{/if}}
});

describe('{{personal.names.exportAdapter}}, on {{aggregate.table}}', () => {
  it.todo('hands over the columns of the subject as plain data, under its source, and nothing of the others');
  it.todo('answers what the row reads once the subject is erased');
});

describe('{{personal.names.fake}} and {{personal.names.exportFake}}', () => {
  it('counts the rows it holds of a person, and forgets them at the first erasure', async () => {
    const fake = new {{personal.names.fake}}().holds('ada', 2);

    expect(await fake.erase('ada')).toBe(2);
    expect(await fake.erase('ada')).toBe(0);
    expect(fake.erased).toEqual(['ada', 'ada']);
  });

  it('hands over the records it holds of a person, and remembers who was asked', async () => {
    const record = { source: SOURCE, values: { kept: 'of ada' } };
    const fake = new {{personal.names.exportFake}}().holds('ada', record);

    expect(await fake.exportOf('ada')).toEqual([record]);
    expect(await fake.exportOf('bob')).toEqual([]);
    expect(fake.asked).toEqual(['ada', 'bob']);
  });
});
