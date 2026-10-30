**A new project gives `vitest` and `@vitest/coverage-v8` the same range (`^5.0.3`).** Every test run printed "Running mixed versions is not supported" because the coverage package was pinned exactly while `vitest` resolved to a later patch.

To move: in a project already created, write `"@vitest/coverage-v8": "^5.0.3"` in `package.json` and install again.
