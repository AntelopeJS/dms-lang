# `playground`

A DMS project that loads `@antelopejs/dms-lang` from the parent folder, with editing on and a writable app layer. From the repository root, `pnpm dev` starts its backend on port 5010 and `pnpm frontend:dev` starts its dashboard on port 3001. It reads MongoDB at `MONGO_URL`, or `mongodb://localhost:27017` when that is unset.

## Requirements

<!-- antelopejs-docs-compat:start -->

| Package                                     | Supported                                                         | Tested with                                                    |
| ------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------- |
| `@antelopejs/dms`                           | `file:../.campaign/tgz/antelopejs-dms-14e671d.tgz`                | `file:.campaign/tgz/antelopejs-dms-14e671d.tgz`                |
| `@antelopejs/interface-api`                 | `>=0.2.0 <1.0.0`                                                  | `0.2.0`                                                        |
| `@antelopejs/interface-api-util`            | `>=0.3.0 <1.0.0`                                                  | `0.3.0`                                                        |
| `@antelopejs/interface-core`                | `>=0.4.0 <1.0.0`                                                  | `0.4.0`                                                        |
| `@antelopejs/interface-data-api`            | `file:../.campaign/tgz/antelopejs-interface-data-api-d8a868f.tgz` | `file:.campaign/tgz/antelopejs-interface-data-api-d8a868f.tgz` |
| `@antelopejs/interface-database`            | `>=0.3.0 <1.0.0`                                                  | `0.3.0`                                                        |
| `@antelopejs/interface-database-decorators` | `>=0.2.0 <1.0.0`                                                  | `0.2.0`                                                        |
| `@antelopejs/interface-dms`                 | `file:../.campaign/tgz/antelopejs-interface-dms-14e671d.tgz`      | `file:.campaign/tgz/antelopejs-interface-dms-14e671d.tgz`      |

<!-- antelopejs-docs-compat:end -->
