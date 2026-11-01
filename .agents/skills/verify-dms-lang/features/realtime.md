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

- `a-subscriber-hears-the-topic-by-its-name`: the playground's app module subscribes to `dms-lang.translations` with `SubscribeMessage`, as the docs invite a module to; a text saved and a key created through the API each reach it with the workspace and the key. A topic renamed on both sides of Lang leaves this subscriber deaf.

## How to get to it (user POV)

- Two people open the same workspace's matrix.

## Driving it with dms-control

```bash
dms-control journey "$RUN" realtime
```

## Gotchas

- The playground subscriber appends what it hears to `verify-realtime-heard.jsonl` in the run's `HOME`; the journey looks for the workspace and key it wrote, so earlier lines do not matter.
- Both tabs are the same administrator; the writer's tab sends its realtime session so its own change is not announced back to it.
