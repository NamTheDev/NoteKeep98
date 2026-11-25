# Project guide

**Website:** https://namthedev.github.io/keep/

A local-first notes app with a compact, Catppuccin, dark-first Bootstrap 6-based interface. It runs in the browser and does **not** have a hosted database, login or sync server.

## Using keep

Use the quick composer to capture notes; create notes/checklists, switch grid/list view, manage backups and open Settings from the sidebar. Search stays next to the current view title. The sidebar also contains All Notes, Reminders, Archive, Recycle Bin and custom labels. On smaller screens, use the folder-menu button to open the drawer. The redundant File/Edit/View/Help menu and separate top toolbar have been removed.

Features include editing, pinning, colors, labels, reminders, checklists, duplication, archive/trash, undo, and JSON backup import/export. Import, export and sample restore are sidebar actions. Appearance preferences are in **Settings**. Keyboard shortcuts include Ctrl+K for search, Ctrl+Enter to save, and N outside text fields to create a note.

## Privacy and compatibility

Notes and settings stay in this browser's `localStorage`; no account or cloud sync is provided. The existing `notekeep98-v1` key and legacy migration path are intentionally retained so existing users do not lose notes. Clearing site data can permanently erase notes; export a JSON backup first. In-app reminders do not issue system notifications.

## Design system

Both [keep](https://github.com/NamTheDev/keep) and [clipboard](https://github.com/NamTheDev/clipboard) use the shared Catppuccin Bootstrap 6 system: Roboto, Material Symbols Rounded, dark-first/light-toggle themes, compact spacing, 10px card rounding, hybrid tonal/outlined surfaces, and no UI animations. [`NamTheDev/util/design/config.css`](https://github.com/NamTheDev/util/blob/main/design/config.css) is the canonical stylesheet. Both apps vendor identical configuration copies; local CSS owns layouts. Both apps synchronize from that source. Each app has its own layout and behavior. The locally vendored Bootstrap 6.0.0-alpha.2 CSS loads before the shared override. Browser support requires Chrome/Edge 138, Firefox 147, or Safari 26. The icon font loads from Google Fonts, with sans-serif fallback; the favicon is a separate graphic.

Legacy Windows 95/98 reference documents in `docs/` record earlier design work; they do not describe the current UI.

## Source organization

See [Architecture](ARCHITECTURE.md). The entrypoint `src/main.ts` coordinates state and events. Note model/storage, filtering, cards and backups live in `src/features/notes/`. Layout, icons and composer helpers live in `src/ui/`; reusable escaping/date formatters live in `src/utils/`.

## Development

Requires Bun 1.1+.

```sh
bun install
bun run dev
bun run typecheck
bun run build
```

The production build in `dist/` is published by [GitHub Pages Actions](../.github/workflows/deploy-pages.yml). `server.ts` is for development/testing only. The [UI verification](../.github/workflows/ui-verification.yml) workflow exercises the browser on desktop and mobile. Source is MIT-licensed; see [CREDITS.md](../CREDITS.md) and [AI_DISCLAIMER.md](../AI_DISCLAIMER.md).
