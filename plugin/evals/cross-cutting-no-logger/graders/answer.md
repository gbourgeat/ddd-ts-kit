---
type: llm
weight: 1
---

PASS if the answer keeps the logger out of the handler and the application layer: it either says that every log line already carries the tenant through the bus middleware of the platform (src/platform/observability/) and shows where, or adds the logging there (a middleware of the command bus, outside the contexts). FAIL if a logger is injected into or called from the handler, or from any file of application/ or domain/.
