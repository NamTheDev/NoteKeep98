# keep architecture

## Frontend

- `src/main.ts` — stateful application coordinator: data mutations, commands, render updates, and event handlers.
- `src/features/notes/data.ts` — note types, defaults, local storage, and migration compatibility.
- `src/features/notes/selectors.ts` — pure note filtering and sorting.
- `src/features/notes/note-card.ts` — stateless note-card rendering.
- `src/features/notes/backup.ts` — JSON backup download.
- `src/ui/shell.ts` — app layout and contextual controls; no redundant top menu/toolbar.
- `src/ui/icons.ts` — Material Symbols Rounded semantic icon mapping.
- `src/ui/quick-composer.ts` — standalone quick-composer DOM behavior.
- `src/utils/format.ts` — safe HTML escaping and date/time formatting.
- `src/style.css` — shared MD3 stylesheet; canonical for clipboard's sync workflow.
- `scripts/build.ts` — Bun JS bundling and versioned CSS/JS output.

## Boundaries

Do not make pure note helpers depend on the UI coordinator. Keep storage format and keys stable. Treat each UI command as one readable operation, with its related mutation and user feedback together. Remove obsolete desktop window-manager and app-menu handlers rather than keeping dead code. Avoid new application-wide dependencies for one feature.

## Verification

Run `bun run typecheck`, `bun run build`, and the Playwright UI workflow. Existing note editing, search, labels, import/export, checklist, reminders, archive/trash, keyboard shortcuts, theme persistence and mobile navigation must survive.
