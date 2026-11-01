# Changelog

## v0.5.0

[compare changes](https://github.com/AntelopeJS/dms-lang/compare/v0.4.1...v0.5.0)

### 🚀 Enhancements

- **frontend:** Enforce the backend boundary in production builds ([#60](https://github.com/AntelopeJS/dms-lang/pull/60))

### 🩹 Fixes

- **playground:** Declare the frontend, and run the layer's scripts from the playground ([#53](https://github.com/AntelopeJS/dms-lang/pull/53))
- **frontend:** Use the core API error presenter ([#103](https://github.com/AntelopeJS/dms-lang/pull/103))

### 💅 Refactors

- Clean up the tests, comments, types and oversize files ([#59](https://github.com/AntelopeJS/dms-lang/pull/59))
- Clear the residual ratchet findings ([#63](https://github.com/AntelopeJS/dms-lang/pull/63))
- **amp:** Narrow the forwarded location header with a JSDoc type guard ([#66](https://github.com/AntelopeJS/dms-lang/pull/66))

### 📖 Documentation

- **changelog:** Breaking changes of dms-lang 0.4.1 ([#52](https://github.com/AntelopeJS/dms-lang/pull/52))
- **readme:** Link the DMS in the opening line ([#83](https://github.com/AntelopeJS/dms-lang/pull/83))
- **readme:** Use one Discord invite ([#81](https://github.com/AntelopeJS/dms-lang/pull/81))

### 📦 Build

- Adopt the AntelopeJS guardrail pack ([#54](https://github.com/AntelopeJS/dms-lang/pull/54))
- **deps:** Bump @antelopejs/tooling-configs to 0.2.17 ([#67](https://github.com/AntelopeJS/dms-lang/pull/67))

### 🏡 Chore

- Configure Renovate with the shared preset ([#55](https://github.com/AntelopeJS/dms-lang/pull/55))

### ✅ Tests

- **skills:** Add eval cases for dms-lang skills ([#58](https://github.com/AntelopeJS/dms-lang/pull/58))

### 🤖 CI

- Cache the test harness modules and MongoDB binary ([#57](https://github.com/AntelopeJS/dms-lang/pull/57))

### ❤️ Contributors

- Antony Rizzitelli ([@Upd4ting](http://github.com/Upd4ting))
- Alessandro Aloisio ([@alessaloisio](http://github.com/alessaloisio))

## v0.4.1

[compare changes](https://github.com/AntelopeJS/dms-lang/compare/v0.4.0...v0.4.1)

### ⚠️ Breaking changes

This patch release contains breaking changes. Ranges such as `^0.4.0` resolve to it.

- Requires `@antelopejs/dms` 0.11 (`>=0.11.0 <1.0.0`), `@antelopejs/interface-dms` `>=0.9.0 <1.0.0` and the renderer `@antelopejs/dms-frontend` 0.9 (`>=0.9.0 <0.10.0`). Projects on DMS 0.10 must stay on 0.4.0.
- The workspace page declares its record through interface-dms 0.9's `record` option: when the workspace is deleted, the DMS shows a "Deleted" toast and opens the workspace list ([#50](https://github.com/AntelopeJS/dms-lang/pull/50)).

### 🚀 Enhancements

- **workspace:** Declare the workspace page's record and its list ([#50](https://github.com/AntelopeJS/dms-lang/pull/50))

### 📦 Build

- Run on @antelopejs/dms 0.11, interface-dms 0.9 and dms-frontend 0.9 ([#51](https://github.com/AntelopeJS/dms-lang/pull/51))

### ❤️ Contributors

- Antony Rizzitelli <rizzitelli.antony@pm.me>

## v0.4.0

[compare changes](https://github.com/AntelopeJS/dms-lang/compare/v0.3.1...v0.4.0)

### 🚀 Enhancements

- **frontend:** The frontend registration as a pure function, declared as dmsFrontend ([#47](https://github.com/AntelopeJS/dms-lang/pull/47))
- **matrix:** Open the key panel in the DMS drawer ([#45](https://github.com/AntelopeJS/dms-lang/pull/45))

### 🩹 Fixes

- **i18n:** Name workspaces by their label and finish the French wording ([#41](https://github.com/AntelopeJS/dms-lang/pull/41))
- **registry:** Follow late frontend modules on FrontendModulesChanged, not a 2 s poll ([#46](https://github.com/AntelopeJS/dms-lang/pull/46))

### 📦 Build

- Run on @antelopejs/dms 0.10 and @antelopejs/dms-frontend 0.8 ([#49](https://github.com/AntelopeJS/dms-lang/pull/49))

### ✅ Tests

- Render secret for dms 0.10, api 1.4.0 and core 1.17.0 in the test stack ([#48](https://github.com/AntelopeJS/dms-lang/pull/48))

### ❤️ Contributors

- Maxime Westhoven ([@mwesto](http://github.com/mwesto))
- Antony Rizzitelli <rizzitelli.antony@pm.me>

## v0.3.1

[compare changes](https://github.com/AntelopeJS/dms-lang/compare/v0.3.0...v0.3.1)

### 🩹 Fixes

- **frontend:** Run on @antelopejs/dms-frontend 0.7 ([#44](https://github.com/AntelopeJS/dms-lang/pull/44))

### 📖 Documentation

- Clarify learning paths and illustrate real outcomes ([#40](https://github.com/AntelopeJS/dms-lang/pull/40))

### 🤖 CI

- Add the ubuntu job required by the branch rulesets ([#42](https://github.com/AntelopeJS/dms-lang/pull/42))

### ❤️ Contributors

- Antony Rizzitelli <rizzitelli.antony@pm.me>

## v0.3.0

[compare changes](https://github.com/AntelopeJS/dms-lang/compare/v0.2.1...v0.3.0)

### 🩹 Fixes

- Discover late frontend modules and write project keys to their own file ([#39](https://github.com/AntelopeJS/dms-lang/pull/39))

### ❤️ Contributors

- Maxime Westhoven ([@mwesto](http://github.com/mwesto))

## v0.2.1

[compare changes](https://github.com/AntelopeJS/dms-lang/compare/v0.2.0...v0.2.1)

### 📖 Documentation

- Add user guide, screenshots and dms-lang skill ([#31](https://github.com/AntelopeJS/dms-lang/pull/31))
- Streamline agent guidance ([#35](https://github.com/AntelopeJS/dms-lang/pull/35))
- Clarify the supported Lang integration boundary ([#36](https://github.com/AntelopeJS/dms-lang/pull/36))
- Make dense guide sections easier to scan ([#37](https://github.com/AntelopeJS/dms-lang/pull/37))

### ❤️ Contributors

- Antony Rizzitelli <rizzitelli.antony@pm.me>

## v0.2.0

[compare changes](https://github.com/AntelopeJS/dms-lang/compare/v0.1.1...v0.2.0)

### 🚀 Enhancements

- ⚠️  Migrate to DMS 0.9 and renderer 0.6 ([#33](https://github.com/AntelopeJS/dms-lang/pull/33))

#### ⚠️ Breaking Changes

- ⚠️  Migrate to DMS 0.9 and renderer 0.6 ([#33](https://github.com/AntelopeJS/dms-lang/pull/33))

### ❤️ Contributors

- Antony Rizzitelli <rizzitelli.antony@pm.me>

## v0.1.1

[compare changes](https://github.com/AntelopeJS/dms-lang/compare/v0.1.0...v0.1.1)

### 📦 Build

- **deps:** Bump @antelopejs/dms to 0.8.0 and interface-dms to 0.6.0 ([#30](https://github.com/AntelopeJS/dms-lang/pull/30))

### 🤖 CI

- Speed up pipeline ([#29](https://github.com/AntelopeJS/dms-lang/pull/29))

### ❤️ Contributors

- Antony Rizzitelli <rizzitelli.antony@pm.me>

## v0.1.0

[compare changes](https://github.com/AntelopeJS/dms-lang/compare/v0.0.7...v0.1.0)

### 🚀 Enhancements

- **lang:** ⚠️  Port the v2 design on DMS 0.7 ([#26](https://github.com/AntelopeJS/dms-lang/pull/26))

### 🏡 Chore

- **playground:** Run api ^1.3.1 and open module source ranges ([#24](https://github.com/AntelopeJS/dms-lang/pull/24))

#### ⚠️ Breaking Changes

- **lang:** ⚠️  Port the v2 design on DMS 0.7 ([#26](https://github.com/AntelopeJS/dms-lang/pull/26))

### ❤️ Contributors

- Antony Rizzitelli <rizzitelli.antony@pm.me>

## v0.0.7

[compare changes](https://github.com/AntelopeJS/dms-lang/compare/v0.0.6...v0.0.7)

### 🚀 Enhancements

- **frontend-vue:** Declare the @antelopejs/dms-frontend releases the layer supports ([#21](https://github.com/AntelopeJS/dms-lang/pull/21))

### 🏡 Chore

- **lint:** Check @antelopejs/interface-* ranges ([#23](https://github.com/AntelopeJS/dms-lang/pull/23))

### ❤️ Contributors

- Alessandro Aloisio ([@alessaloisio](http://github.com/alessaloisio))
- Antony Rizzitelli <rizzitelli.antony@pm.me>

## v0.0.6

[compare changes](https://github.com/AntelopeJS/dms-lang/compare/v0.0.5...v0.0.6)

### 🩹 Fixes

- **deps:** Accept compatible 0.x versions of the interface packages ([#20](https://github.com/AntelopeJS/dms-lang/pull/20))

### ❤️ Contributors

- Alessandro Aloisio ([@alessaloisio](http://github.com/alessaloisio))

## v0.0.5

[compare changes](https://github.com/AntelopeJS/dms-lang/compare/v0.0.4...v0.0.5)

### 🩹 Fixes

- **deps:** Accept @antelopejs/interface-api 0.0.14 and later 0.x ([#17](https://github.com/AntelopeJS/dms-lang/pull/17))

### 💅 Refactors

- **build:** Merge tsconfig.build.json into tsconfig.json ([#13](https://github.com/AntelopeJS/dms-lang/pull/13))

### 🏡 Chore

- Update DMS CLI commands ([#8](https://github.com/AntelopeJS/dms-lang/pull/8))
- Add orb playground setup ([#9](https://github.com/AntelopeJS/dms-lang/pull/9))
- **playground:** Use dms frontend 0.2.1 ([#10](https://github.com/AntelopeJS/dms-lang/pull/10))
- **agents:** Install Node 24 in setup script ([#11](https://github.com/AntelopeJS/dms-lang/pull/11))

### 🤖 CI

- **release:** Release next from a dedicated branch and restore requireCommits ([#14](https://github.com/AntelopeJS/dms-lang/pull/14))
- **release:** Reference the shared release workflows through v1 ([#15](https://github.com/AntelopeJS/dms-lang/pull/15))

### ❤️ Contributors

- Antony Rizzitelli <rizzitelli.antony@pm.me>

## v0.0.4

[compare changes](https://github.com/AntelopeJS/dms-lang/compare/v0.0.3...v0.0.4)

### 💅 Refactors

- **frontend:** Import the SDK through #dms/frontend-module ([#7](https://github.com/AntelopeJS/dms-lang/pull/7))

### 🏡 Chore

- Require @antelopejs/core 1.7 ([#5](https://github.com/AntelopeJS/dms-lang/pull/5))
- Align community files with the organization defaults ([#6](https://github.com/AntelopeJS/dms-lang/pull/6))

### ❤️ Contributors

- Antony Rizzitelli <rizzitelli.antony@pm.me>

## v0.0.3

[compare changes](https://github.com/AntelopeJS/dms-lang/compare/v0.0.2...v0.0.3)

## v0.0.2

[compare changes](https://github.com/AntelopeJS/dms-lang/compare/v0.0.1...v0.0.2)

### 🏡 Chore

- Regenerate lockfiles against the published DMS packages ([#1](https://github.com/AntelopeJS/dms-lang/pull/1))
- **release:** Skip the npm auth pre-flight for trusted publishing ([#2](https://github.com/AntelopeJS/dms-lang/pull/2))

### ❤️ Contributors

- Antony Rizzitelli <rizzitelli.antony@pm.me>

