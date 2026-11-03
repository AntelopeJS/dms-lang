# `playground`

A DMS project that loads `@antelopejs/dms-lang` from the parent folder, with editing on and a writable app layer. From the repository root, `pnpm dev` starts its backend on port 5010 and `pnpm frontend:dev` starts its dashboard on port 3001. It reads MongoDB at `MONGO_URL`, or `mongodb://localhost:27017` when that is unset.

## Requirements

<!-- antelopejs-docs-compat:start -->

| Package                                     | Supported                                                                    | Tested with                                                               |
| ------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `@antelopejs/dms`                           | `file:../.campaign/tgz/antelopejs-dms-80e4dc1.tgz`                           | `file:.campaign/tgz/antelopejs-dms-80e4dc1.tgz`                           |
| `@antelopejs/interface-api`                 | `file:../.campaign/tgz/antelopejs-interface-api-f2a99b5.tgz`                 | `file:.campaign/tgz/antelopejs-interface-api-f2a99b5.tgz`                 |
| `@antelopejs/interface-api-util`            | `file:../.campaign/tgz/antelopejs-interface-api-util-639f38b.tgz`            | `file:.campaign/tgz/antelopejs-interface-api-util-639f38b.tgz`            |
| `@antelopejs/interface-core`                | `file:../.campaign/tgz/antelopejs-interface-core-f7df541.tgz`                | `file:.campaign/tgz/antelopejs-interface-core-f7df541.tgz`                |
| `@antelopejs/interface-data-api`            | `file:../.campaign/tgz/antelopejs-interface-data-api-d8a868f.tgz`            | `file:.campaign/tgz/antelopejs-interface-data-api-d8a868f.tgz`            |
| `@antelopejs/interface-database`            | `file:../.campaign/tgz/antelopejs-interface-database-02e0360.tgz`            | `file:.campaign/tgz/antelopejs-interface-database-02e0360.tgz`            |
| `@antelopejs/interface-database-decorators` | `file:../.campaign/tgz/antelopejs-interface-database-decorators-e79a62b.tgz` | `file:.campaign/tgz/antelopejs-interface-database-decorators-e79a62b.tgz` |
| `@antelopejs/interface-dms`                 | `file:../.campaign/tgz/antelopejs-interface-dms-0cfaaa3.tgz`                 | `file:.campaign/tgz/antelopejs-interface-dms-0cfaaa3.tgz`                 |

<!-- antelopejs-docs-compat:end -->
