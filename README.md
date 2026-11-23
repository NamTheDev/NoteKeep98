# keep

**Web app:** https://namthedev.github.io/keep/

A GitHub Pages-only, local-first notes app inspired by classic Windows 95/98. It runs entirely in your browser: **no hosted database, external API, login, Railway service, or sync server**.

## Features

- Create, edit, pin and duplicate notes and checklists.
- Search notes, filter labels, use list/grid layouts, reminders and a quick-note composer.
- Archive, restore, recycle and permanently remove notes; undo supported actions.
- Select paper colors and organize notes with tags.
- Export notes to a JSON backup and import them on another device.
- Switch between classic and dark Windows 98 system themes (persisted locally).
- Windows-style menus, bevels, modal dialogs, responsive layout, taskbar and desktop shortcuts.

**Storage:** Notes live in the current browser's `localStorage`, not on GitHub or in a remote account. They don't synchronize between browsers. Keep a JSON backup before clearing browser data. An existing internal storage key is retained to preserve notes across updates. The application is named **keep** everywhere in its interface and exported backups.

## One canonical public site

The website is published to GitHub Pages by [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml) on pushes to `main`. The compiled `dist/` folder contains only `index.html`, `app.js`, `style.css` and `favicon.svg`. Build-time Bun and TypeScript are **not deployed as a server**. `server.ts` remains only as a local development/testing tool.

Canonical address: **https://namthedev.github.io/keep/**. The browser title and favicon are **keep**; referral `utm_*` parameters are discarded from the displayed address.

## Unified visual design

Both [keep](https://namthedev.github.io/keep/) and [clipboard](https://namthedev.github.io/clipboard/) implement [Chris Lemke's Windows 95/98 reference](https://chrislemke.github.io/website_designs/designs/Windows_95_98.html). They use the same teal `#008080` desktop, silver `#c0c0c0` panels, navy-to-blue title bars, square controls, four-tone raised/recessed bevels, compact menu/toolbar and grayscale system pictograms.

The neutral dark-mode palette is an adaptation, not an official variant in the reference. Note-card color swatches intentionally remain colorful because they're user content, not system UI icons. See [shared design contract](docs/DESIGN_REFERENCE.md), [design audit](docs/DESIGN_REFERENCE_AUDIT.md) and [credits](CREDITS.md).

## Development and verification

The published site needs **no runtime server**. Local development/build uses [Bun](https://bun.sh/) 1.1+:

```sh
bun install
bun run dev
```

Visit `http://localhost:3000`. For a production-style preview:

```sh
bun run typecheck
bun run build
NODE_ENV=production bun run start
```

Continuous integration validates TypeScript, the Pages build, Chromium UI behavior on desktop and mobile, and published asset paths. The [commit-format](.github/workflows/commit-message-format.yml) and [AI-disclosure](.github/workflows/ai-disclosure-format.yml) workflows enforce the repository's conventions. See [commit_message_format.txt](commit_message_format.txt) and [AI_DISCLAIMER.md](AI_DISCLAIMER.md). Screenshots are uploaded as CI artifacts; generated screenshots and compiled files are not committed to this repository.

## Security and limitations

Your notes reside in browser storage; this is not an encrypted password vault. Deleting the browser profile, clearing site data, or changing devices can lose notes without backups. Reminder dates are shown inside the app and are not scheduled push notifications. The project is independent of Google, Microsoft and the design-reference creator.

## License

MIT. Design attribution and independent implementation credits: [CREDITS.md](CREDITS.md).
