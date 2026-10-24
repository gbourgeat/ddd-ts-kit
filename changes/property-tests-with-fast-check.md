**The invariants of a value object are stated as properties, with fast-check.** `fast-check` joins
the development dependencies with the first property (`npm i -D fast-check`, under Vitest as under
Jest: a project without a property carries no dead dependency); `fc.assert(fc.property(..))` is an
assertion for `test/assertion-present`; and the spec `generate value-object` writes ends with a
planned rule, `keeps its invariants for any value a generator can produce, as a property`, to remind
of it. A property states a law of the model once and checks it on generated values, the failing one
printed with its seed and shrunk to the smallest: two ranges overlap in both directions or in none,
a slot is held at least until it ends, a parse then a format gives the value back. The example
states four on its ranges and slots. A property is for a law, an invariant, a symmetry, a round trip,
an idempotence; the orchestration of a use case is stated by its scenarios. The testing skill and
the testing strategy say when and how.

To move: `npm i -D fast-check`, then state the first law a value object of yours holds for every
value.
