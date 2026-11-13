# `playground`

A DMS project that loads `@antelopejs/dms-lang` from the parent folder, with editing on and a writable app layer. From the repository root, `pnpm dev` starts its backend on port 5010 and `pnpm frontend:dev` starts its dashboard on port 3001. It reads MongoDB at `MONGO_URL`, or `mongodb://localhost:27017` when that is unset.

## Requirements

<!-- antelopejs-docs-compat:start -->

| Package                                     | Supported         | Tested with |
| ------------------------------------------- | ----------------- | ----------- |
| `@antelopejs/dms`                           | `>=0.19.0 <1.0.0` | `0.19.4`    |
| `@antelopejs/interface-api`                 | `>=0.3.1 <1.0.0`  | `0.3.2`     |
| `@antelopejs/interface-api-util`            | `>=0.3.0 <1.0.0`  | `0.3.0`     |
| `@antelopejs/interface-core`                | `>=0.4.0 <1.0.0`  | `0.4.0`     |
| `@antelopejs/interface-data-api`            | `>=0.6.0 <1.0.0`  | `0.6.0`     |
| `@antelopejs/interface-database`            | `>=0.3.0 <1.0.0`  | `0.3.0`     |
| `@antelopejs/interface-database-decorators` | `>=0.3.1 <1.0.0`  | `0.4.1`     |
| `@antelopejs/interface-dms`                 | `>=0.13.0 <1.0.0` | `0.13.2`    |

<!-- antelopejs-docs-compat:end -->
