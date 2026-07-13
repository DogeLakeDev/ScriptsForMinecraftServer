### Module Catalog

This directory is the source of truth for the project module catalog.

- `catalog.json` defines module metadata, dependencies, and deployment targets.
- `module-lock.json` stores install state and is written by `db-server`.

The catalog is intentionally project-level, not file-level. A module should map to a feature or service boundary, not a single source file.
