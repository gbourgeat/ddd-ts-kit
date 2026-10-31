**A project is green right after `generate guard`: the spec of a guard runs both branches of the stub.** The stub refuses every caller who has an id, and the generated spec now holds the two cases, a caller with an id that is refused with 403 and a caller without one that is let through, where it ran the refusing branch only and `test:coverage` failed on the 70 percent branch floor of the presentation layer with every test green. The `it.todo` for the real rule stays, to replace both tests with one per decision of the guard.

A guard already generated keeps its spec.
