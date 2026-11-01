---
covers:
  - src/utils/announce.ts
docs:
  - docs/5.extending.md
---

# Realtime

Every write publishes on the `dms-lang.translations` topic. The Lang pages subscribe to it, so another tab, or another user, sees a change without reloading.

## Sub-features

- `another-tab-sees-an-edit`: with the matrix open in a second tab, a French text saved in the first tab and one written through the API each appear in the second tab without a reload.

## How to get to it (user POV)

- Two people open the same workspace's matrix.

## Driving it with dms-control

```bash
dms-control journey "$RUN" realtime
```

## Gotchas

- Both tabs are the same administrator; the writer's tab sends its realtime session so its own change is not announced back to it.
