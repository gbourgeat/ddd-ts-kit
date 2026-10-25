#!/usr/bin/env node
// The parity of the families of packages: the members of a family (the four ORM, the brokers,
// the loggers) offer the same options for each port and run its contract with the same
// capabilities. Every asymmetry is a decision written in `families.mjs`, with its reason, so
// that an option or a tested behaviour added to one member alone fails here.
//
//   node pipeline/monorepo/parity.mjs --check

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTRACTS_DIR, FAMILIES } from './families.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = problemsOf(FAMILIES, repositorySource());

  for (const problem of problems) {
    console.error(problem);
  }

  if (problems.length > 0) {
    console.error(
      `\n${problems.length} parity problem(s). The families and their decisions are in pipeline/monorepo/families.mjs.`,
    );
    process.exit(1);
  }

  console.log(`The ${FAMILIES.length} families are at parity.`);
}

/**
 * The problems of the families against the sources: `source.sources(member)` and
 * `source.tests(member)` are the TypeScript files of a package as `{ file, text }`, and
 * `source.contracts` those of the contract suites.
 */
export function problemsOf(families, source) {
  const capabilitiesOf = optionalKeysOfContracts(source.contracts);

  return families.flatMap((family) =>
    family.ports.flatMap((port) => {
      const at = `${family.family}, ${port.port}`;
      const keysOf = new Map(family.members.map((member) => [member, optionKeys(member, port, source)]));

      return [
        ...missingInterfaces(at, port, keysOf),
        ...optionProblems(at, port, keysOf),
        ...contractProblems(at, port, { source, capabilitiesOf }),
      ];
    }),
  );
}

function missingInterfaces(at, port, keysOf) {
  return [...keysOf]
    .filter(([, keys]) => keys === undefined)
    .map(([member]) => `${at}: ${port.options[member]} is not an interface of ${member}/src.`);
}

/** Each option of a member is a place, or every member has it, or the members without it are listed with why. */
function optionProblems(at, port, keysOf) {
  const place = port.place ?? [];
  const offered = [...new Set([...keysOf.values()].flatMap((keys) => keys ?? []))].filter(
    (key) => !place.includes(key),
  );
  const forgotten = Object.keys(port.apart ?? {}).filter((key) => !offered.includes(key));

  return [
    ...offered.flatMap((key) => optionGaps(at, { key, excused: port.apart?.[key] ?? {} }, keysOf)),
    ...forgotten.map((key) => `${at}: no member offers \`${key}\` any more: remove it from families.mjs.`),
  ];
}

/** The members without an option that no reason excuses, and the excuses that no longer hold. */
function optionGaps(at, { key, excused }, keysOf) {
  const members = [...keysOf.keys()];
  const without = members.filter((member) => !(keysOf.get(member) ?? []).includes(key));
  const having = members.filter((member) => !without.includes(member)).join(', ');

  return [
    ...without
      .filter((member) => excused[member] === undefined)
      .map(
        (member) =>
          `${at}: ${member} has no option \`${key}\`, which ${having} ${verb(having, 'offers', 'offer')}. Add it, or say in families.mjs (apart) why ${member} goes without.`,
      ),
    ...Object.keys(excused)
      .filter((member) => !without.includes(member))
      .map((member) => `${at}: ${member} now offers \`${key}\`: remove its exception from families.mjs (apart).`),
  ];
}

/** Each member runs the contract of the port, with every capability another member gives it, or says why not. */
function contractProblems(at, port, { source, capabilitiesOf }) {
  if (port.contract === undefined) {
    return [];
  }

  const capabilities = capabilitiesOf.get(port.contract);

  if (capabilities === undefined) {
    return [`${at}: ${port.contract} is not a contract of ${CONTRACTS_DIR}.`];
  }

  const callsOf = new Map(
    Object.keys(port.options).map((member) => [member, callsIn(source.tests(member), port.contract)]),
  );

  return [
    ...runProblems(at, port, callsOf),
    ...capabilities.flatMap((capability) => capabilityGaps({ at, port }, capability, callsOf)),
  ];
}

function runProblems(at, port, callsOf) {
  return [...callsOf].flatMap(([member, calls]) => {
    const excuse = port.withoutContract?.[member];

    if (calls.length === 0 && excuse === undefined) {
      return [
        `${at}: the specs of ${member} never run ${port.contract}. Hold its adapter to it, or say in families.mjs (withoutContract) why not.`,
      ];
    }

    return calls.length > 0 && excuse !== undefined
      ? [`${at}: ${member} now runs ${port.contract}: remove its withoutContract.`]
      : [];
  });
}

/** The members that run the contract without a capability another member gives it, unless a reason excuses them. */
function capabilityGaps({ at, port }, capability, callsOf) {
  const running = [...callsOf.keys()].filter((member) => callsOf.get(member).length > 0);
  const given = running.filter((member) => callsOf.get(member).some((call) => mentions(call, capability)));
  const excused = port.capabilitiesApart?.[capability] ?? {};

  if (given.length === 0) {
    return [];
  }

  const giving = given.join(', ');

  return [
    ...running
      .filter((member) => !given.includes(member) && excused[member] === undefined)
      .map(
        (member) =>
          `${at}: ${member} runs ${port.contract} without \`${capability}\`, which ${giving} ${verb(giving, 'gives', 'give')} it. Give it, or say in families.mjs (capabilitiesApart) why not.`,
      ),
    ...Object.keys(excused)
      .filter((member) => given.includes(member))
      .map(
        (member) =>
          `${at}: ${member} now gives \`${capability}\` to ${port.contract}: remove its exception from families.mjs (capabilitiesApart).`,
      ),
  ];
}

function verb(subjects, one, several) {
  return subjects.includes(',') ? several : one;
}

/** The keys of the options interface of a member, its `extends` resolved in the package; `[]` without one; `undefined` when it is not found. */
function optionKeys(member, port, source) {
  const name = port.options[member];

  if (name === null) {
    return [];
  }

  return keysOfInterface(name, interfacesOf(source.sources(member)));
}

/** The interfaces of a package by name: their `extends` clause and the keys of their top level. */
function interfacesOf(files) {
  const found = new Map();

  for (const { text } of files) {
    // An empty body closes on its own line: `{}`.
    for (const match of text.matchAll(
      /export interface (\w+)(?:<[^>{]*>)?(?:\s+extends\s+([^{]+))?\s*\{(?:\}|([\s\S]*?)\n\})/g,
    )) {
      const keys = [...(match[3] ?? '').matchAll(/^ {2}(?:readonly )?(\w+)\??[:(]/gm)].map((key) => key[1]);

      found.set(match[1], { extends: match[2]?.trim() ?? '', keys });
    }
  }

  return found;
}

function keysOfInterface(name, interfaces, seen = new Set()) {
  const declared = interfaces.get(name);

  if (declared === undefined || seen.has(name)) {
    return undefined;
  }

  seen.add(name);

  const inherited = splitTopLevel(declared.extends).flatMap((clause) => keysOfClause(clause, interfaces, seen));

  return [...new Set([...inherited, ...declared.keys])];
}

/** `Name`, `Pick<Name, 'a' | 'b'>` or `Omit<Name, 'a'>`; a type of another package adds nothing. */
function keysOfClause(clause, interfaces, seen) {
  const picked = /^Pick<\s*\w+(?:<[^>]*>)?\s*,\s*([^>]+)>$/.exec(clause);

  if (picked !== null) {
    return quoted(picked[1]);
  }

  const omitted = /^Omit<\s*(\w+)(?:<[^>]*>)?\s*,\s*([^>]+)>$/.exec(clause);

  if (omitted !== null) {
    const left = quoted(omitted[2]);

    return (keysOfInterface(omitted[1], interfaces, seen) ?? []).filter((key) => !left.includes(key));
  }

  return keysOfInterface(clause.replace(/<.*$/, ''), interfaces, seen) ?? [];
}

function quoted(text) {
  return [...text.matchAll(/'(\w+)'/g)].map((match) => match[1]);
}

function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let current = '';

  for (const character of text) {
    depth += character === '<' ? 1 : character === '>' ? -1 : 0;

    if (character === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }

  return current.trim() === '' ? parts : [...parts, current.trim()];
}

/** The optional keys of the options of each contract: what a member may or may not give it. */
function optionalKeysOfContracts(files) {
  const interfaces = interfacesOf(files);
  const contracts = new Map();

  for (const { text } of files) {
    for (const match of text.matchAll(/export function (\w+Contract)\b[\s\S]*?options: (\w+)/g)) {
      const options = interfaces.get(match[2]);

      contracts.set(match[1], options === undefined ? [] : optionalKeysIn(match[2], files));
    }
  }

  return contracts;
}

function optionalKeysIn(name, files) {
  for (const { text } of files) {
    const body = new RegExp(`export interface ${name}\\b[^{]*\\{(?:\\}|([\\s\\S]*?)\\n\\})`).exec(text);

    if (body !== null) {
      return [...(body[1] ?? '').matchAll(/^ {2}(?:readonly )?(\w+)\?[:(]/gm)].map((key) => key[1]);
    }
  }

  return [];
}

/** The text of each call of `contract(...)` in the specs. */
function callsIn(files, contract) {
  const calls = [];

  for (const { text } of files) {
    let start = text.indexOf(`${contract}(`);

    while (start !== -1) {
      const open = start + contract.length;
      calls.push(text.slice(open, closingOf(text, open) + 1));
      start = text.indexOf(`${contract}(`, open);
    }
  }

  return calls;
}

function closingOf(text, open) {
  let depth = 0;

  for (let index = open; index < text.length; index += 1) {
    depth += text[index] === '(' ? 1 : text[index] === ')' ? -1 : 0;

    if (depth === 0) {
      return index;
    }
  }

  return text.length - 1;
}

/** Whether a call gives a capability: `capability:`, `capability(` or the shorthand `capability,` / `capability }`. */
function mentions(call, capability) {
  return new RegExp(`\\b${capability}\\s*(?:[:(,]|\\})`).test(call);
}

function repositorySource() {
  return {
    sources: (member) => typescriptFiles(path.join(ROOT, 'packages', member, 'src')),
    tests: (member) => typescriptFiles(path.join(ROOT, 'packages', member, 'test')),
    contracts: typescriptFiles(path.join(ROOT, CONTRACTS_DIR)),
  };
}

function typescriptFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs
    .readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => {
      const file = path.join(entry.parentPath, entry.name);

      return { file: path.relative(ROOT, file), text: fs.readFileSync(file, 'utf8') };
    });
}
