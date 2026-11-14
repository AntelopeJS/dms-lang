# Changelog

## v0.7.0

[compare changes](https://github.com/AntelopeJS/dms-lang/compare/v0.6.0...v0.7.0)

### 🩹 Fixes

- **deps:** Accept any zod 3.x from 3.24.2 so the project shares one zod copy ([#146](https://github.com/AntelopeJS/dms-lang/pull/146))
- **frontend:** Use the component names of DMS 0.20 ([#147](https://github.com/AntelopeJS/dms-lang/pull/147))

### 💅 Refactors

- **frontend:** Lint auto-imported names against the DMS globals ([#141](https://github.com/AntelopeJS/dms-lang/pull/141))
- **frontend:** Lint frontend-vue with the AntelopeJS Nuxt preset ([#142](https://github.com/AntelopeJS/dms-lang/pull/142))

### 📖 Documentation

- **changelog:** Breaking changes of dms-lang 0.6.0 ([#140](https://github.com/AntelopeJS/dms-lang/pull/140))

### 📦 Build

- **deps:** ⚠️  Move to DMS 0.20, interface-dms 0.14 and tooling-configs 0.7 ([#145](https://github.com/AntelopeJS/dms-lang/pull/145))

### 🤖 CI

- **frontend:** Check Prettier formatting in format:check ([#144](https://github.com/AntelopeJS/dms-lang/pull/144))
- Run CI on Windows beside Linux ([#143](https://github.com/AntelopeJS/dms-lang/pull/143))

#### ⚠️ Breaking Changes

- **deps:** ⚠️  Move to DMS 0.20, interface-dms 0.14 and tooling-configs 0.7 ([#145](https://github.com/AntelopeJS/dms-lang/pull/145))

### ❤️ Contributors

- Antony Rizzitelli ([@Upd4ting](http://github.com/Upd4ting))

## v0.6.0

[compare changes](https://github.com/AntelopeJS/dms-lang/compare/v0.5.3...v0.6.0)

### 💅 Refactors

- **lint:** Fix the code behind nine eslint rule-offs and the one ts-expect-error ([#138](https://github.com/AntelopeJS/dms-lang/pull/138))

### 📦 Build

- **deps:** ⚠️  Move to DMS 0.19, interface-dms 0.13 and interface-api 0.3 ([#139](https://github.com/AntelopeJS/dms-lang/pull/139))

### ⚠️ Breaking changes

- Requires `@antelopejs/dms` 0.19 (`>=0.19.0 <1.0.0`), `@antelopejs/interface-dms` `>=0.13.0 <1.0.0`, `@antelopejs/interface-api` `>=0.3.1 <1.0.0` and `@antelopejs/interface-database-decorators` `>=0.3.1 <1.0.0`. Projects on DMS 0.18 must stay on 0.5.3 ([#139](https://github.com/AntelopeJS/dms-lang/pull/139)).
- A query parameter given without a value, such as `?workspace` or `?workspace=`, counts as absent. It used to fail with a 500 ([#139](https://github.com/AntelopeJS/dms-lang/pull/139)).

### ❤️ Contributors

- Antony Rizzitelli ([@Upd4ting](http://github.com/Upd4ting))

## v0.5.3

[compare changes](https://github.com/AntelopeJS/dms-lang/compare/v0.5.2...v0.5.3)

### 🔥 Performance

- **message-check:** Keep message verdicts for workspaces past 50,000 texts ([#133](https://github.com/AntelopeJS/dms-lang/pull/133))
- **message-check:** Parse messages without generating their code ([#135](https://github.com/AntelopeJS/dms-lang/pull/135))
- **public:** Parse a served language file once until it changes ([#134](https://github.com/AntelopeJS/dms-lang/pull/134))

### 🩹 Fixes

- **registry:** Follow a module's layers layout while it runs ([#137](https://github.com/AntelopeJS/dms-lang/pull/137))

### 📦 Build

- **deps:** Bump @antelopejs/tooling-configs to 0.5.0 ([#132](https://github.com/AntelopeJS/dms-lang/pull/132))
- **deps:** Bump @antelopejs/tooling-configs to 0.5.1 ([#136](https://github.com/AntelopeJS/dms-lang/pull/136))

### ❤️ Contributors

- Antony Rizzitelli ([@Upd4ting](http://github.com/Upd4ting))

## v0.5.2

[compare changes](https://github.com/AntelopeJS/dms-lang/compare/v0.5.1...v0.5.2)

### 🚀 Enhancements

- **skills:** Add the verify-dms-lang verification skill ([#84](https://github.com/AntelopeJS/dms-lang/pull/84))

### 🩹 Fixes

- **verify:** Run every feature when a shared file changes ([#122](https://github.com/AntelopeJS/dms-lang/pull/122))
- **knip:** Give the root workspace the AntelopeJS rules ([#125](https://github.com/AntelopeJS/dms-lang/pull/125))
- **matrix:** Open the base-text clear confirmation above the key panel ([#127](https://github.com/AntelopeJS/dms-lang/pull/127))
- **workspaces:** Keep a card's Switch button inside the card when its URL is long ([#128](https://github.com/AntelopeJS/dms-lang/pull/128))
- **workspace:** Keep the first Type click after typing a description ([#124](https://github.com/AntelopeJS/dms-lang/pull/124))
- **lang:** Stop the workspace name hint from reserving all ([#123](https://github.com/AntelopeJS/dms-lang/pull/123))
- **matrix:** Count every language under Every language, whatever columns are shown ([#131](https://github.com/AntelopeJS/dms-lang/pull/131))

### 📖 Documentation

- **usage:** Describe the To review state and Mark as reviewed ([#126](https://github.com/AntelopeJS/dms-lang/pull/126))
- **readme:** Open with the AntelopeJS DMS module kit ([#130](https://github.com/AntelopeJS/dms-lang/pull/130))

### 📦 Build

- **deps:** Bump @antelopejs packages to the 2026-11-06 releases ([#121](https://github.com/AntelopeJS/dms-lang/pull/121))
- **deps:** Bump @antelopejs/dms to 0.18.2 and drop verify publish ([#129](https://github.com/AntelopeJS/dms-lang/pull/129))

### 🏡 Chore

- Remove the .amp directory ([#117](https://github.com/AntelopeJS/dms-lang/pull/117))
- **verify:** Remove seeded runs from the verification skill ([#118](https://github.com/AntelopeJS/dms-lang/pull/118))
- **ci:** Remove the weekly mutation caller ([#119](https://github.com/AntelopeJS/dms-lang/pull/119))

### 🤖 CI

- Call ci-node.yml@v1 ([#120](https://github.com/AntelopeJS/dms-lang/pull/120))

### ❤️ Contributors

- Antony Rizzitelli ([@Upd4ting](http://github.com/Upd4ting))

## v0.5.1

[compare changes](https://github.com/AntelopeJS/dms-lang/compare/v0.5.0...v0.5.1)

### 📖 Documentation

- **github:** Send questions and ideas to Discord ([#107](https://github.com/AntelopeJS/dms-lang/pull/107))

### 🏡 Chore

- Land the cleanup campaign on main ([#116](https://github.com/AntelopeJS/dms-lang/pull/116))

### ❤️ Contributors

- Antony Rizzitelli ([@Upd4ting](http://github.com/Upd4ting))

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

