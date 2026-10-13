**English** · [Français](representations-and-forms.fr.md)

# Representations and forms: XML, CSV, JSON Forms and its renderers

**Summary.** `@ddd-ts-kit/http` writes JSON, XML and CSV, reads XML, negotiates on `Accept`,
reserves fields to some callers and describes forms in JSON Forms and as a neutral tree of
blocks, with no runtime dependency: the XML parser and writer and the CSV writer are the
package's own, small on purpose. This page says why no library was taken for XML and CSV, which
JSON Forms renderer to use on the front end, what the alternatives to JSON Forms are, and the
limits. Versions were read with `npm view` on 2026-10-13. The concepts are in
[concepts/representations-and-forms.md](../concepts/representations-and-forms.md), the how-to in
the [README of `@ddd-ts-kit/http`](../../packages/http/README.md).

## XML: a parser of the package's own, or a library

| Option | Licence | What it brings | Why not here |
|---|---|---|---|
| The package's own (`XmlRepresentation`) | MIT, in the package | elements, attributes, CDATA, comments, processing instructions, the five predefined entities and character references; no document type declaration, so no entity at all; 64 levels at most; reads by the response schema | it is chosen: a body needs no more, and refusing DTDs closes XXE and expansion bombs by construction rather than by an option to remember |
| [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) 5.11.2 | MIT | fast, validating, a builder, entity options | the mapping from XML to the JSON model is ours anyway (it follows the schema); one more optional peer for what 200 lines do |
| [xmlbuilder2](https://github.com/oozcitak/xmlbuilder2) 4.0.3 | MIT | a full DOM, namespaces, serialisation | heavy for writing one value; a DOM is not needed to stream a list |
| [sax](https://github.com/isaacs/sax-js) 1.6.1 | BlueOak-1.0.0 | a streaming parser | request bodies are bounded by the body parser of the framework; streaming reads are not needed |

Take a library in your own anti-corruption layer when a partner imposes namespaces, mixed
content or an XML Schema: that format is a model of its own, mapped to yours, not a
representation of yours.

## CSV: written by the package

| Option | Licence | Why not here |
|---|---|---|
| The package's own (`CsvRepresentation`) | MIT, in the package | chosen: RFC 4180 quoting, a header from the schema, streaming, and the formula guard below |
| [csv-stringify](https://csv.js.org/stringify/) 6.9.0 | MIT | a good choice for an import or for options the kit does not offer (delimiters, BOM); not needed to write flat rows |
| [Papa Parse](https://www.papaparse.com/) 5.7.0 | MIT | a parser first; CSV is never read by a route here |

A text cell starting with `=`, `+`, `-`, `@`, a tab or a carriage return is prefixed with `'`
(the OWASP advice against CSV injection); a number is never touched. A consumer that needs the
raw text back strips that one character.

## Forms: JSON Forms on the front end

The neutral tree of blocks is the model of the kit; JSON Forms is its first mapper, recommended
because maintained renderers exist for the three common frameworks, all under the MIT licence
and released together (3.8.0):

| Front end | Packages | Notes |
|---|---|---|
| React | `@jsonforms/core`, `@jsonforms/react`, `@jsonforms/material-renderers` (MUI) or `@jsonforms/vanilla-renderers` | the most used set; custom renderers by tester and rank |
| Angular | `@jsonforms/core`, `@jsonforms/angular`, `@jsonforms/angular-material` | Angular Material controls |
| Vue | `@jsonforms/core`, `@jsonforms/vue`, `@jsonforms/vue-vanilla` or `@jsonforms/vue-vuetify` | Vue 3 |

```tsx
// React: the three parts of the answer, as they are
const { schema, uischema, data } = await (await fetch('/forms/bookAppointment?calendarId=c-1')).json();

<JsonForms schema={schema} uischema={uischema} data={data} renderers={materialRenderers} cells={materialCells}
  i18n={{ translate: (key) => messages[key] }} onChange={({ data }) => setBooking(data)} />
```

What maps to what:

| In the description | In JSON Forms | A renderer shows |
|---|---|---|
| a group | `Group` element, `i18n` key | a titled section |
| a field | `Control` with a `scope`, `i18n` key | the control of its schema type |
| read-only | `readOnly: true` in the schema and `options.readonly` | a disabled control |
| a read-only object | `readOnly: true` on the object, and `options.readonly` on each of its controls | a group of disabled controls |
| the form refused to the caller | `403` instead of the form | the front end's message: the user may not run the use case |
| hidden for the caller | absent from both schemas | nothing |
| `widget: 'textarea'`, `'radio'` | `options.multi`, `options.format: 'radio'` | a multi-line input, radio buttons |
| `widget: 'datetime'`, `'date'`, `'time'` | `format` of the property | a date-time, date or time picker |
| options from a closed vocabulary | `enum` | a select |
| `visibleWhen` | a `SHOW` rule | the control appears when the condition holds |
| `requiredWhen` | `allOf` of `if`/`then` in the schema | an error while the field is empty |
| `lookup` | `options.lookup` (operation, method, path) | nothing by itself: a custom renderer calls the route |

A lookup is the one part no stock renderer understands: register a custom renderer for
controls with `options.lookup` that calls the route and fills the options.

### Alternatives to JSON Forms

| Library | Licence | Fits when |
|---|---|---|
| [react-jsonschema-form](https://rjsf-team.github.io/react-jsonschema-form/) (`@rjsf/core` 6.11.0) | Apache-2.0 | a React application already on it: give it `schema` of the JSON Forms answer; its own UI schema is another dialect, mapped from the tree of blocks |
| [Formly](https://formly.dev/) (`@ngx-formly/core` 9.0.0) | MIT | an Angular application already on Formly: map the tree of blocks to its field configuration |
| [uniforms](https://uniforms.tools/) 4.0.0 | MIT | React with a schema bridge; JSON Schema is one of its bridges |
| the tree of blocks, rendered by hand | | a design system of your own: groups, fields, widgets and options are already resolved for the caller |

Other dialects are small mappers of the tree of blocks, written in the front end, not in the
kit.

## Limits

- Translation keys only: the server sends no label text. The front end owns its messages.
- Conditions are simple: one field equal to a value, or to one of several. A condition over
  several fields is a business rule, answered by the command.
- The form describes the body of one route; a wizard over several routes is the front end's.
- The XML of the kit has one default namespace at most, on the root, and no mixed content.
- JSON Forms validates with AJV in the browser: what it accepts the server may still refuse, by
  a business rule or by a field the caller may not set.
- A renderer that ignores `readOnly` on an object group (some vanilla sets) still disables its
  controls, which carry `options.readonly` each.

## See also

- [HTTP frameworks](http-frameworks.md): how each adapter reads an XML body.
- [Authorization engines](authorization-engines.md): the decisions a field requirement uses.
- [Validation](validation.md): the schemas the representations and the forms are read from.
