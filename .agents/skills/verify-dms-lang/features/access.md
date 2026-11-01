---
covers:
  - src/utils/config.ts
  - src/pages/actions.ts
  - src/pages/page-actions.ts
  - src/pages/component-action.ts
  - src/pages/index.ts
  - src/routes/index.ts
  - src/routes/translations.ts
  - src/utils/body.ts
  - src/utils/errors.ts
  - src/utils/constants.ts
  - src/index.ts
docs:
  - docs/1.introduction.md
  - docs/3.configuration.md
  - docs/5.extending.md
  - docs/6.faq.md
---

# Access

The Lang pages and the HTTP API under `/api/lang/translations` are reserved to the platform owner. Every write also needs `editable: true` and the permission of its page action.

## Sub-features

- `anonymous-callers-are-refused`: error path: a visitor gets 401 on reads, backups and writes, the public files stay open, and nothing a visitor sent changed the workspace.
- `read-only-without-editable`: with `editable` off, every write (create, rename, delete, import, add or remove a language, make a base, create, update, rename or delete a key, change the description and type, drop an override, mark a key reviewed) answers 403 `read_only`, reads and the public files keep working and nothing is written.
- `read-only-by-default`: a module configured without `editable` lists `editable: false` and refuses a create with 403 `read_only`, as the configuration page says.
- `permissions-follow-the-page-tree`: `GET /workspaces` names the permission ids of the writes (`modules.lang.translate.translations.scoped.matrix.edit`, `.keys`, `modules.lang.manage.workspaces.list.create`, ...).

## How to get to it (user POV)

- Set `editable: true` on the process that should write; sign in as the platform owner.

## Driving it with dms-control

```bash
dms-control journey "$RUN" access
```

## Gotchas

- The verification playground reads `DMS_LANG_EDITABLE`: on unless it is `false`, and `default` leaves the option out. `read-only-without-editable` and `read-only-by-default` set it in the run's environment, restart the backend, and put the environment back when they end.
- A member who is not the owner is not driven here: the Members flow needs the invitation email and is the DMS skill's.
