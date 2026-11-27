# `playground`

A DMS project that loads `@antelopejs/dms-lang` from the parent folder, with editing on and a writable app layer. From the repository root, `pnpm dev` starts its backend on port 5010 and `pnpm frontend:dev` starts its dashboard on port 3001. It reads MongoDB at `MONGO_URL`, or `mongodb://localhost:27017` when that is unset.

## Requirements

<!-- antelopejs-docs-compat:start -->

| Package                                     | Supported                   | Tested with                 |
| ------------------------------------------- | --------------------------- | --------------------------- |
| `@antelopejs/dms`                           | `0.24.3-next.1066.g4f2d355` | `0.24.3-next.1066.g4f2d355` |
| `@antelopejs/interface-api`                 | `>=0.3.4 <0.4.0`            | `0.3.5`                     |
| `@antelopejs/interface-api-util`            | `>=0.3.3 <0.4.0`            | `0.3.3`                     |
| `@antelopejs/interface-core`                | `>=0.5.2 <0.6.0`            | `0.5.2`                     |
| `@antelopejs/interface-data-api`            | `>=0.8.2 <0.9.0`            | `0.8.2`                     |
| `@antelopejs/interface-database`            | `>=0.4.3 <0.5.0`            | `0.4.4`                     |
| `@antelopejs/interface-database-decorators` | `>=0.5.4 <0.6.0`            | `0.5.4`                     |
| `@antelopejs/interface-dms`                 | `>=0.17.0 <0.18.0`          | `0.17.2-next.1066.g4f2d355` |

<!-- antelopejs-docs-compat:end -->
