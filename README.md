# keep

**Website:** https://namthedev.github.io/keep/

A local-first notes app with a compact, monochrome, dark-first Material Design 3-inspired interface. It runs in the browser and does **not** have a hosted database, login or sync server.

## Using keep

Create a note or checklist from the quick composer; search, switch grid/list view, and open Settings alongside the notes heading. The folder sidebar contains All Notes, Reminders, Archive, Recycle Bin and custom labels. On smaller screens, use the folder-menu button to open the drawer. The redundant File/Edit/View/Help menu and separate top toolbar have been removed.

Features include editing, pinning, colors, labels, reminders, checklists, duplication, archive/trash, undo, and JSON backup import/export. Import, export, appearance and reset are available in **Settings**. Keyboard shortcuts include Ctrl+K for search, Ctrl+Enter to save, and N outside text fields to create a note.

## Privacy and compatibility

Notes and settings stay in this browser's `localStorage`; no account or cloud sync is provided. The existing `notekeep98-v1` key and legacy migration path are intentionally retained so existing users do not lose notes. Clearing site data can permanently erase notes; export a JSON backup first. In-app reminders do not issue system notifications.

## Design system

Both [keep](https://github.com/NamTheDev/keep) and [clipboard](https://github.com/NamTheDev/clipboard) use the shared monochrome Material Design 3 system: Roboto, Material Symbols Rounded, dark-first/light-toggle themes, compact spacing, 16px baseline rounding, hybrid tonal/outlined surfaces, and no UI animations. `src/style.css` is the canonical shared stylesheet; clipboard synchronizes this file using its design-sync workflow. Each app has its own layout and behavior. The icon font loads from Google Fonts, with sans-serif fallback; the favicon is a separate graphic.

Legacy Windows 95/98 reference documents in `docs/` record earlier design work; they do not describe the current UI.

## Source organization

See [Architecture](docs/ARCHITECTURE.md). The entrypoint `src/main.ts` coordinates state and events. Note model/storage, filtering, cards and backups live in `src/features/notes/`. Layout, icons and composer helpers live in `src/ui/`; reusable escaping/date formatters live in `src/utils/`.

## Development

Requires Bun 1.1+.

```sh
bun install
bun run dev
bun run typecheck
bun run build
```

The production build in `dist/` is published by [GitHub Pages Actions](.github/workflows/deploy-pages.yml). `server.ts` is for development/testing only. The [UI verification](.github/workflows/ui-verification.yml) workflow exercises the browser on desktop and mobile. Source is MIT-licensed; see [CREDITS.md](CREDITS.md) and [AI_DISCLAIMER.md](AI_DISCLAIMER.md).
