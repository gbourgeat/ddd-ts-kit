import { describe, expect, it } from 'vitest';
import { fitBlock, fitSource, fitStatement } from '../src/layout/index.js';

const LONG = 'InternationalPurchaseOrder';

describe('a declaration laid out for the names of the project', () => {
  it('gives each type argument of a generic parent a line when the class only extends it', () => {
    const source = `export class ${LONG}Projection extends Projection<${LONG}Placed, ${LONG}Cancelled, ${LONG}Shipped> {\n}`;

    expect(fitSource(source).split('\n')).toEqual([
      `export class ${LONG}Projection extends Projection<`,
      `  ${LONG}Placed,`,
      `  ${LONG}Cancelled,`,
      `  ${LONG}Shipped`,
      '> {',
      '}',
    ]);
  });

  it('gives each clause of the heritage a line when the class also implements a port', () => {
    const source = `export class ${LONG}Projection extends Projection<${LONG}Placed, ${LONG}Cancelled> implements ${LONG}Reader {`;

    expect(fitSource(source).split('\n')).toEqual([
      `export class ${LONG}Projection`,
      `  extends Projection<${LONG}Placed, ${LONG}Cancelled>`,
      `  implements ${LONG}Reader`,
      '{',
    ]);
  });

  it('gives each type argument of a generic alias a line, the last one without a comma', () => {
    const source = `export type ${LONG}Events = DomainEvents<${LONG}Placed, ${LONG}Cancelled, ${LONG}Shipped, Other>;`;

    expect(fitSource(source).split('\n')).toEqual([
      `export type ${LONG}Events = DomainEvents<`,
      `  ${LONG}Placed,`,
      `  ${LONG}Cancelled,`,
      `  ${LONG}Shipped,`,
      '  Other',
      '>;',
    ]);
  });

  it('gives each parameter of a method a line, its return type kept after the parenthesis', () => {
    const source = `  async place(command: Place${LONG}Command, actor: ${LONG}Actor): Promise<${LONG}Result> {\n  }`;

    expect(fitSource(source).split('\n')).toEqual([
      '  async place(',
      `    command: Place${LONG}Command,`,
      `    actor: ${LONG}Actor,`,
      `  ): Promise<${LONG}Result> {`,
      '  }',
    ]);
  });

  it('breaks a returned call as a statement and not as a signature', () => {
    const source = `  return compute${LONG}Total(order.lines, order.currency, order.discounts, order.taxes, order.shipping);`;

    expect(fitSource(source).split('\n')).toEqual([
      `  return compute${LONG}Total(`,
      '    order.lines,',
      '    order.currency,',
      '    order.discounts,',
      '    order.taxes,',
      '    order.shipping,',
      '  );',
    ]);
  });

  it('writes a condition alone on its line operand by operand, each && at the end of its line', () => {
    const condition = `    ${LONG}.isPlaced(order) && ${LONG}.isPaid(order) && ${LONG}.isNotCancelled(order) && order.ok`;

    expect(fitSource(['  if (', condition, '  ) {'].join('\n')).split('\n')).toEqual([
      '  if (',
      `    ${LONG}.isPlaced(order) &&`,
      `    ${LONG}.isPaid(order) &&`,
      `    ${LONG}.isNotCancelled(order) &&`,
      '    order.ok',
      '  ) {',
    ]);
  });

  it('leaves a condition that mixes || with && or nests an && inside brackets on its line', () => {
    const mixed = `    ${LONG}.isPlaced(order) || ${LONG}.isPaid(order) && ${LONG}.isNotCancelled(order) && order.ok`;
    const nested = `    check(${LONG}.isPlaced(order) && ${LONG}.isPaid(order)) && ${LONG}.isNotCancelled(order) && order.ok`;

    expect(fitSource(mixed)).toBe(mixed);
    expect(fitSource(nested)).toBe(nested);
  });

  it('leaves a line of text inside a template literal alone, however long', () => {
    const source = ['const text = `', `  ${'a long text line '.repeat(8)}`, '`;'].join('\n');

    expect(fitSource(source)).toBe(source);
  });

  it('sets a broken chain apart from the statement above it and leaves the closing brace below it', () => {
    const chain = `new ${LONG}Builder().withName(${LONG}Name).withTotal(${LONG}Total).build();`;

    expect(fitSource(['  return x;', `  const value = ${chain}`, '}'].join('\n')).split('\n')).toEqual([
      '  return x;',
      '',
      `  const value = new ${LONG}Builder()`,
      `    .withName(${LONG}Name)`,
      `    .withTotal(${LONG}Total)`,
      '    .build();',
      '}',
    ]);
  });
});

describe('a statement broken after its operator', () => {
  it('moves a constructor with a long name under the = of its declaration', () => {
    const statement = `const repository = new InMemory${LONG}RepositoryWithAuditAndTenancyAndSoftDeletionEnabled${LONG};`;

    expect(fitStatement(statement, '  ')).toEqual([
      '  const repository =',
      `    new InMemory${LONG}RepositoryWithAuditAndTenancyAndSoftDeletionEnabled${LONG};`,
    ]);
  });

  it('moves the value of a property that no bracket lets open under its name', () => {
    const value = `${LONG}Placed`.repeat(5);

    expect(fitStatement(`placed: ${value},`, '    ')).toEqual(['    placed:', `      ${value},`]);
  });

  it('moves the call a function answers under its arrow and opens its arguments when it still does not fit', () => {
    const statement = `resolve: (context) => context.${LONG}Repository.findAll${LONG}sPlacedBefore${LONG}Deadline(context.now),`;

    expect(fitStatement(statement, '    ')).toEqual([
      '    resolve: (context) =>',
      `      context.${LONG}Repository.findAll${LONG}sPlacedBefore${LONG}Deadline(`,
      '        context.now,',
      '      ),',
    ]);
  });

  it('keeps the function a call receives last on the line of the call and moves what it answers below', () => {
    const statement = `items.map((item) => ${LONG}Mapper.toDomain(item, context, options, ${LONG}Defaults));`;

    expect(fitStatement(statement, '    ')).toEqual([
      '    items.map((item) =>',
      `      ${LONG}Mapper.toDomain(item, context, options, ${LONG}Defaults),`,
      '    );',
    ]);
  });

  it('leaves on its line a call with no argument or a statement with no bracket to open', () => {
    const empty = `await platform.${LONG}Service.someVeryLongMethodNameThatGoesOnAndOn${LONG}AndStillGoesOn${LONG}();`;
    const bare = `${LONG}.${LONG}.${LONG}.${LONG}.${LONG}.${LONG}.value;`;

    expect(fitStatement(empty, '    ')).toEqual([`    ${empty}`]);
    expect(fitStatement(bare, '')).toEqual([bare]);
  });

  it('opens every argument when the call ends with two literals of the same kind', () => {
    const statement = `register(${LONG}Command, [${LONG}Handler, ${LONG}Policy, ${LONG}Validator, ${LONG}Logger], [Other]);`;

    expect(fitStatement(statement, '    ')).toEqual([
      '    register(',
      `      ${LONG}Command,`,
      '      [',
      `        ${LONG}Handler,`,
      `        ${LONG}Policy,`,
      `        ${LONG}Validator,`,
      `        ${LONG}Logger,`,
      '      ],',
      '      [Other],',
      '    );',
    ]);
  });
});

describe('a block a template adds to a region', () => {
  it('gives each argument a line when the head of a callback no longer fits, its body one step to the right', () => {
    const head = `events.on('order-fulfilment.${LONG}Placed.v1', async (event: ${LONG}PlacedIntegrationEvent) => {`;

    expect(fitBlock([head, '  await handler.handle(event);', '', '  done();', '});'], '  ')).toEqual([
      'events.on(',
      `  'order-fulfilment.${LONG}Placed.v1',`,
      `  async (event: ${LONG}PlacedIntegrationEvent) => {`,
      '    await handler.handle(event);',
      '',
      '    done();',
      '  },',
      ');',
    ]);
  });

  it('breaks the chain a callback ends instead when there is one', () => {
    const head = `platform.events.subscribe('order-fulfilment.${LONG}Placed.v1').then(async (event: ${LONG}Placed) => {`;

    expect(fitBlock([head, '  await handler.handle(event);', '});'], '  ')).toEqual([
      'platform.events',
      `  .subscribe('order-fulfilment.${LONG}Placed.v1')`,
      `  .then(async (event: ${LONG}Placed) => {`,
      '    await handler.handle(event);',
      '  });',
    ]);
  });

  it('leaves a callback alone when it fits or when its closing line is missing', () => {
    const fits = ["events.on('a', async (event: Placed) => {", '  x();', '});'];

    const unclosed = [
      `events.on('order-fulfilment.${LONG}Placed.v1', async (event: ${LONG}PlacedIntegration) => {`,
      '  x();',
    ];

    expect(fitBlock(fits, '  ')).toEqual(fits);
    expect(fitBlock(unclosed, '  ')).toEqual(unclosed);
  });

  it('sets a statement it broke apart from the statements around it', () => {
    const chain = `builder.bind(${LONG}Repository).toClass(Drizzle${LONG}Repository, [Database, Clock]).as('repository');`;

    expect(fitBlock(['const a = 1;', chain, 'const b = 2;'], '    ')).toEqual([
      'const a = 1;',
      '',
      'builder',
      `  .bind(${LONG}Repository)`,
      `  .toClass(Drizzle${LONG}Repository, [Database, Clock])`,
      "  .as('repository');",
      '',
      'const b = 2;',
    ]);
  });
});
