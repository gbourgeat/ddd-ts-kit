**`clean/stepdown` reports on a JavaScript file too.** The rule kept the references of a function
that the scope manager of typescript-eslint marks as values; the scope manager of the default
parser of ESLint, which lints a `.mjs`, `.cjs` or `.js` file, marks nothing, so on such a file the
rule found no caller and reported nothing. A reference the parser does not qualify is a value
now. The preset of the kit applies the rule to TypeScript sources only; a project that applies it
to its scripts as well sees what it reports there from this version on.
